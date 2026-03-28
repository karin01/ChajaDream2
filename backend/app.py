from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from werkzeug.utils import secure_filename

# backend/.env 에 텔레그램 등 비밀 설정 (파일 없으면 무시)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

from telegram_notify import (
    detect_chajunda_imbo_labels,
    format_chajunda_imbo_community_notification,
    format_found_pet_notification,
    format_lost_pet_notification,
    is_telegram_bot_configured,
    is_telegram_configured,
    notify_community_keyword_subscribers,
    notify_telegram,
    notify_telegram_routed,
)
from telegram_bot import process_telegram_update
from telegram_routing import has_region_routes_file
from telegram_subscribers import ensure_telegram_subscribers_table, subscriber_count
from banned_words import moderation_violation_message

app = Flask(__name__)
# CORS 설정 강화: 모든 origin, credentials, 모든 경로 허용
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- 기존 임시 메모리 DB (동물 게시판) ---
posts = []

# --- SQLite 커뮤니티 게시판 DB 설정 ---
DB_PATH = os.path.join(os.path.dirname(__file__), 'community.db')

# DB 파일이 위치할 폴더가 없으면 생성
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # dict처럼 사용
    return conn


def _moderation_block_response(*text_parts: str | None):
    """금지어 포함 시 (Response, 400), 통과 시 None."""
    msg = moderation_violation_message(*text_parts)
    if msg:
        return jsonify({"error": msg}), 400
    return None


def _staff_secret_valid(data: dict | None) -> bool:
    """요청 본문의 staffSecret 이 .env STAFF_MODE_SECRET 과 일치하면 운영진 권한으로 간주."""
    env_secret = os.environ.get("STAFF_MODE_SECRET", "").strip()
    if not env_secret or not data:
        return False
    incoming = (data.get("staffSecret") or data.get("staff_secret") or "").strip()
    return incoming == env_secret

def init_db():
    conn = get_db()
    cur = conn.cursor()
    
    # 커뮤니티 테이블 생성 (없으면)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS community (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author TEXT NOT NULL,
            created_at TEXT NOT NULL,
            password TEXT NOT NULL,
            photoUrl TEXT
        )
    ''')
    
    # 실종동물 테이블 생성
    cur.execute('''
        CREATE TABLE IF NOT EXISTS lost_pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            petType TEXT NOT NULL,
            breed TEXT NOT NULL,
            gender TEXT NOT NULL,
            petName TEXT,
            age TEXT,
            color TEXT NOT NULL,
            description TEXT,
            lostDate TEXT NOT NULL,
            lostTime TEXT,
            address TEXT NOT NULL,
            contactName TEXT NOT NULL,
            contactPhone TEXT NOT NULL,
            photoUrl TEXT,
            author TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # 발견동물 테이블 생성
    cur.execute('''
        CREATE TABLE IF NOT EXISTS found_pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            petType TEXT NOT NULL,
            breed TEXT NOT NULL,
            gender TEXT NOT NULL,
            petName TEXT,
            age TEXT,
            color TEXT NOT NULL,
            description TEXT,
            foundDate TEXT NOT NULL,
            foundTime TEXT,
            address TEXT NOT NULL,
            contactName TEXT NOT NULL,
            contactPhone TEXT NOT NULL,
            photoUrl TEXT,
            author TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # 성공사례 테이블 생성
    cur.execute('''
        CREATE TABLE IF NOT EXISTS success_stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            petType TEXT,
            beforePhotoUrl TEXT,
            afterPhotoUrl TEXT,
            author TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # tags 컬럼이 없으면 추가
    try:
        cur.execute('ALTER TABLE community ADD COLUMN tags TEXT')
    except Exception:
        pass

    # 실종 동물 이름(선택) — 기존 DB 마이그레이션
    try:
        cur.execute('ALTER TABLE lost_pets ADD COLUMN petName TEXT')
    except Exception:
        pass

    # 발견 동물 이름(선택, 목걸이 등) — 기존 DB 마이그레이션
    try:
        cur.execute('ALTER TABLE found_pets ADD COLUMN petName TEXT')
    except Exception:
        pass

    # 텔레그램 지역 구독자 (봇 /subscribe)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS telegram_subscribers (
            telegram_user_id INTEGER NOT NULL,
            chat_id TEXT NOT NULL,
            region_keyword TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (telegram_user_id, region_keyword)
        )
    ''')

    # 커뮤니티 답글(댓글)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS community_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            author TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    try:
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id)"
        )
    except Exception:
        pass

    conn.commit()
    conn.close()
    ensure_telegram_subscribers_table()

init_db()  # 서버 시작 시 DB 자동 생성

# --- 커뮤니티 API ---
@app.route('/api/community', methods=['GET'])
def get_community():
    """
    커뮤니티 게시글 목록 반환 (최신순)
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.*,
            (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = c.id) AS reply_count
        FROM community c
        ORDER BY c.id DESC
        """
    )
    rows = cur.fetchall()
    posts = [dict(row) for row in rows]
    conn.close()
    return jsonify(posts)

@app.route('/api/community', methods=['POST'])
def add_community():
    """
    커뮤니티 게시글 등록 (제목, 내용, 작성자, 비밀번호, 이미지, 태그)
    """
    data = request.get_json()
    required = ['title', 'content', 'author', 'password']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    mod = _moderation_block_response(
        data.get('title'),
        data.get('content'),
        data.get('author'),
        data.get('tags'),
    )
    if mod is not None:
        return mod
    from datetime import datetime
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    photoUrl = data.get('photoUrl', '')
    tags = data.get('tags', '')
    conn = get_db()
    cur = conn.cursor()
    cur.execute('INSERT INTO community (title, content, author, created_at, password, photoUrl, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (data['title'], data['content'], data['author'], created_at, data['password'], photoUrl, tags))
    conn.commit()
    post_id = cur.lastrowid
    conn.close()
    # 실종·발견·찾는다·임보 등 해당 키워드가 있는 커뮤니티 글만 텔레그램 알림
    chajunda_imbo_labels = detect_chajunda_imbo_labels(data)
    if chajunda_imbo_labels:
        notify_telegram(
            format_chajunda_imbo_community_notification(data, post_id, chajunda_imbo_labels)
        )
    # /subscribe 키워드: 제목·본문·태그 기준 DM (실종·발견은 주소 기준으로 별도 처리)
    notify_community_keyword_subscribers(data, post_id)
    return jsonify({'result': 'success', 'id': post_id}), 201

@app.route('/api/community/<int:post_id>', methods=['PUT'])
def update_community(post_id):
    """
    커뮤니티 게시글 수정 (제목, 내용, 작성자, 비밀번호 확인, 이미지, 태그)
    """
    data = request.get_json()
    required = ['title', 'content', 'author', 'password']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    mod = _moderation_block_response(
        data.get('title'),
        data.get('content'),
        data.get('author'),
        data.get('tags'),
    )
    if mod is not None:
        return mod
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password, photoUrl FROM community WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row or row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    incoming_photo = (data.get('photoUrl') or '').strip()
    photoUrl = incoming_photo if incoming_photo else (row['photoUrl'] or '')
    tags = data.get('tags', '')
    cur.execute('UPDATE community SET title=?, content=?, author=?, photoUrl=?, tags=? WHERE id=?',
                (data['title'], data['content'], data['author'], photoUrl, tags, post_id))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

@app.route('/api/community/<int:post_id>', methods=['DELETE'])
def delete_community(post_id):
    """
    커뮤니티 게시글 삭제 — 글 비밀번호 또는 운영진 STAFF_MODE_SECRET(staffSecret).
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    if not staff_ok and not data.get("password"):
        return (
            jsonify(
                {
                    "error": "비밀번호가 필요합니다. 운영진 모드에서는 서버에 설정된 운영 비밀번호로 삭제할 수 있습니다."
                }
            ),
            400,
        )
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password FROM community WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    cur.execute('DELETE FROM community_replies WHERE post_id=?', (post_id,))
    cur.execute('DELETE FROM community WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})


@app.route('/api/community/<int:post_id>/replies', methods=['GET'])
def get_community_replies(post_id):
    """게시글별 답글 목록 (비밀번호는 내려주지 않음)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT 1 FROM community WHERE id=?', (post_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    cur.execute(
        """
        SELECT id, post_id, content, author, created_at
        FROM community_replies WHERE post_id=? ORDER BY id ASC
        """,
        (post_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/community/<int:post_id>/replies', methods=['POST'])
def add_community_reply(post_id):
    """커뮤니티 답글 등록."""
    data = request.get_json()
    required = ['content', 'author', 'password']
    if not data or not all(data.get(k) for k in required):
        return jsonify({'error': '내용·작성자·비밀번호를 모두 입력해 주세요.'}), 400
    mod = _moderation_block_response(data.get('content'), data.get('author'))
    if mod is not None:
        return mod
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT 1 FROM community WHERE id=?', (post_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    from datetime import datetime
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cur.execute(
        """
        INSERT INTO community_replies (post_id, content, author, password, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (post_id, data['content'], data['author'], data['password'], created_at),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({'result': 'success', 'id': new_id}), 201


@app.route('/api/community/<int:post_id>/replies/<int:reply_id>', methods=['DELETE'])
def delete_community_reply(post_id, reply_id):
    """답글 삭제 — 답글 비밀번호 또는 운영진 staffSecret."""
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    if not staff_ok and not data.get("password"):
        return jsonify({'error': '비밀번호가 필요합니다.'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        'SELECT password FROM community_replies WHERE id=? AND post_id=?',
        (reply_id, post_id),
    )
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '답글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    cur.execute(
        'DELETE FROM community_replies WHERE id=? AND post_id=?',
        (reply_id, post_id),
    )
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})


@app.route('/api/staff/verify', methods=['POST'])
def staff_verify():
    """운영진 비밀번호(브라우저 운영진 모드) 확인용 — staffSecret 본문."""
    if not os.environ.get("STAFF_MODE_SECRET", "").strip():
        return jsonify(
            {
                "ok": False,
                "error": "서버에 STAFF_MODE_SECRET 이 없습니다. backend/.env 를 확인해 주세요.",
            }
        )
    data = request.get_json(silent=True) or {}
    if _staff_secret_valid(data):
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "운영진 비밀번호가 일치하지 않습니다."})

# --- 실종동물 API ---
@app.route('/api/lost-pets', methods=['GET'])
def get_lost_pets():
    """
    실종동물 게시글 목록 반환 (최신순)
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT * FROM lost_pets ORDER BY id DESC')
    rows = cur.fetchall()
    posts = [dict(row) for row in rows]
    conn.close()
    return jsonify(posts)

@app.route('/api/lost-pets', methods=['POST'])
def add_lost_pet():
    """
    실종동물 게시글 등록
    """
    data = request.get_json()
    required = ['petType', 'breed', 'gender', 'color', 'address', 'contactName', 'contactPhone', 'lostDate', 'author', 'password']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    petName = (data.get('petName') or '').strip()
    mod = _moderation_block_response(
        data.get('breed'),
        petName,
        data.get('age'),
        data.get('color'),
        data.get('description'),
        data.get('address'),
        data.get('contactName'),
        data.get('author'),
    )
    if mod is not None:
        return mod
    from datetime import datetime
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    photoUrl = data.get('photoUrl', '')
    age = data.get('age', '')
    description = data.get('description', '')
    lostTime = data.get('lostTime', '')
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''INSERT INTO lost_pets 
                   (petType, breed, gender, petName, age, color, description, lostDate, lostTime, address, contactName, contactPhone, photoUrl, author, password, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (data['petType'], data['breed'], data['gender'], petName, age, data['color'], description, 
                 data['lostDate'], lostTime, data['address'], data['contactName'], data['contactPhone'], 
                 photoUrl, data['author'], data['password'], created_at))
    conn.commit()
    post_id = cur.lastrowid
    conn.close()
    lost_body, lost_photo, lost_cap = format_lost_pet_notification(data, post_id)
    notify_telegram_routed(
        lost_body,
        data.get("address"),
        photo_url=lost_photo,
        photo_caption=lost_cap,
    )
    return jsonify({'result': 'success', 'id': post_id}), 201

@app.route('/api/lost-pets/<int:post_id>', methods=['PUT'])
def update_lost_pet(post_id):
    """
    실종동물 게시글 수정 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    required = ['petType', 'breed', 'gender', 'color', 'address', 'contactName', 'contactPhone', 'lostDate', 'author', 'password']
    req_check = [k for k in required if k != 'password'] if staff_ok else required
    if not all(data.get(k) for k in req_check):
        return jsonify({'error': '필수 항목 누락'}), 400
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호 필요'}), 400
    petName = (data.get('petName') or '').strip()
    mod = _moderation_block_response(
        data.get('breed'),
        petName,
        data.get('age'),
        data.get('color'),
        data.get('description'),
        data.get('address'),
        data.get('contactName'),
        data.get('author'),
    )
    if mod is not None:
        return mod
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password, photoUrl FROM lost_pets WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    
    # 빈 문자열이면 기존 사진 유지(수정 폼에서 새 파일 없을 때 클라이언트 실수 방지)
    incoming_photo = (data.get('photoUrl') or '').strip()
    photoUrl = incoming_photo if incoming_photo else (row['photoUrl'] or '')
    age = data.get('age', '')
    description = data.get('description', '')
    lostTime = data.get('lostTime', '')
    
    cur.execute('''UPDATE lost_pets SET petType=?, breed=?, gender=?, petName=?, age=?, color=?, description=?, 
                   lostDate=?, lostTime=?, address=?, contactName=?, contactPhone=?, photoUrl=? WHERE id=?''',
                (data['petType'], data['breed'], data['gender'], petName, age, data['color'], description,
                 data['lostDate'], lostTime, data['address'], data['contactName'], data['contactPhone'], 
                 photoUrl, post_id))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

@app.route('/api/lost-pets/<int:post_id>', methods=['DELETE'])
def delete_lost_pet(post_id):
    """
    실종동물 게시글 삭제 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호가 필요합니다. 운영진 모드에서는 staffSecret 으로 삭제할 수 있습니다.'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password FROM lost_pets WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    cur.execute('DELETE FROM lost_pets WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

# --- 발견동물 API ---
@app.route('/api/found-pets', methods=['GET'])
def get_found_pets():
    """
    발견동물 게시글 목록 반환 (최신순)
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT * FROM found_pets ORDER BY id DESC')
    rows = cur.fetchall()
    posts = [dict(row) for row in rows]
    conn.close()
    return jsonify(posts)

@app.route('/api/found-pets', methods=['POST'])
def add_found_pet():
    """
    발견동물 게시글 등록
    """
    data = request.get_json()
    required = ['petType', 'breed', 'gender', 'color', 'address', 'contactName', 'contactPhone', 'foundDate', 'author', 'password']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    petName = (data.get('petName') or '').strip()
    mod = _moderation_block_response(
        data.get('breed'),
        petName,
        data.get('age'),
        data.get('color'),
        data.get('description'),
        data.get('address'),
        data.get('contactName'),
        data.get('author'),
    )
    if mod is not None:
        return mod
    from datetime import datetime
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    photoUrl = data.get('photoUrl', '')
    age = data.get('age', '')
    description = data.get('description', '')
    foundTime = data.get('foundTime', '')
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''INSERT INTO found_pets 
                   (petType, breed, gender, petName, age, color, description, foundDate, foundTime, address, contactName, contactPhone, photoUrl, author, password, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (data['petType'], data['breed'], data['gender'], petName, age, data['color'], description, 
                 data['foundDate'], foundTime, data['address'], data['contactName'], data['contactPhone'], 
                 photoUrl, data['author'], data['password'], created_at))
    conn.commit()
    post_id = cur.lastrowid
    conn.close()
    found_body, found_photo, found_cap = format_found_pet_notification(data, post_id)
    notify_telegram_routed(
        found_body,
        data.get("address"),
        photo_url=found_photo,
        photo_caption=found_cap,
    )
    return jsonify({'result': 'success', 'id': post_id}), 201

@app.route('/api/found-pets/<int:post_id>', methods=['PUT'])
def update_found_pet(post_id):
    """
    발견동물 게시글 수정 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    required = ['petType', 'breed', 'gender', 'color', 'address', 'contactName', 'contactPhone', 'foundDate', 'author', 'password']
    req_check = [k for k in required if k != 'password'] if staff_ok else required
    if not all(data.get(k) for k in req_check):
        return jsonify({'error': '필수 항목 누락'}), 400
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호 필요'}), 400
    petName = (data.get('petName') or '').strip()
    mod = _moderation_block_response(
        data.get('breed'),
        petName,
        data.get('age'),
        data.get('color'),
        data.get('description'),
        data.get('address'),
        data.get('contactName'),
        data.get('author'),
    )
    if mod is not None:
        return mod
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password, photoUrl FROM found_pets WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    
    incoming_photo = (data.get('photoUrl') or '').strip()
    photoUrl = incoming_photo if incoming_photo else (row['photoUrl'] or '')
    age = data.get('age', '')
    description = data.get('description', '')
    foundTime = data.get('foundTime', '')
    
    cur.execute('''UPDATE found_pets SET petType=?, breed=?, gender=?, petName=?, age=?, color=?, description=?, 
                   foundDate=?, foundTime=?, address=?, contactName=?, contactPhone=?, photoUrl=? WHERE id=?''',
                (data['petType'], data['breed'], data['gender'], petName, age, data['color'], description,
                 data['foundDate'], foundTime, data['address'], data['contactName'], data['contactPhone'], 
                 photoUrl, post_id))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

@app.route('/api/found-pets/<int:post_id>', methods=['DELETE'])
def delete_found_pet(post_id):
    """
    발견동물 게시글 삭제 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호가 필요합니다. 운영진 모드에서는 staffSecret 으로 삭제할 수 있습니다.'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password FROM found_pets WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    cur.execute('DELETE FROM found_pets WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

# --- 성공사례 API ---
@app.route('/api/success-stories', methods=['GET'])
def get_success_stories():
    """
    성공사례 게시글 목록 반환 (최신순)
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT * FROM success_stories ORDER BY id DESC')
    rows = cur.fetchall()
    posts = [dict(row) for row in rows]
    conn.close()
    return jsonify(posts)

@app.route('/api/success-stories', methods=['POST'])
def add_success_story():
    """
    성공사례 게시글 등록
    """
    data = request.get_json()
    required = ['title', 'content', 'author', 'password']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    mod = _moderation_block_response(
        data.get('title'),
        data.get('content'),
        data.get('author'),
        data.get('petType'),
    )
    if mod is not None:
        return mod
    from datetime import datetime
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    petType = data.get('petType', '')
    beforePhotoUrl = data.get('beforePhotoUrl', '')
    afterPhotoUrl = data.get('afterPhotoUrl', '')
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''INSERT INTO success_stories 
                   (title, content, petType, beforePhotoUrl, afterPhotoUrl, author, password, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (data['title'], data['content'], petType, beforePhotoUrl, afterPhotoUrl, 
                 data['author'], data['password'], created_at))
    conn.commit()
    post_id = cur.lastrowid
    conn.close()
    return jsonify({'result': 'success', 'id': post_id}), 201

@app.route('/api/success-stories/<int:post_id>', methods=['PUT'])
def update_success_story(post_id):
    """
    성공사례 게시글 수정 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    required = ['title', 'content', 'author', 'password']
    req_check = [k for k in required if k != 'password'] if staff_ok else required
    if not all(data.get(k) for k in req_check):
        return jsonify({'error': '필수 항목 누락'}), 400
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호 필요'}), 400
    mod = _moderation_block_response(
        data.get('title'),
        data.get('content'),
        data.get('author'),
        data.get('petType'),
    )
    if mod is not None:
        return mod
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password, beforePhotoUrl, afterPhotoUrl FROM success_stories WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    
    petType = data.get('petType', '')
    in_b = (data.get('beforePhotoUrl') or '').strip()
    in_a = (data.get('afterPhotoUrl') or '').strip()
    beforePhotoUrl = in_b if in_b else (row['beforePhotoUrl'] or '')
    afterPhotoUrl = in_a if in_a else (row['afterPhotoUrl'] or '')
    
    cur.execute('''UPDATE success_stories SET title=?, content=?, petType=?, beforePhotoUrl=?, afterPhotoUrl=?, author=? WHERE id=?''',
                (data['title'], data['content'], petType, beforePhotoUrl, afterPhotoUrl, data['author'], post_id))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

@app.route('/api/success-stories/<int:post_id>', methods=['DELETE'])
def delete_success_story(post_id):
    """
    성공사례 게시글 삭제 — 원 비밀번호 또는 운영진 staffSecret
    """
    data = request.get_json(silent=True) or {}
    staff_ok = _staff_secret_valid(data)
    if not staff_ok and not data.get('password'):
        return jsonify({'error': '비밀번호가 필요합니다. 운영진 모드에서는 staffSecret 으로 삭제할 수 있습니다.'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT password FROM success_stories WHERE id=?', (post_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404
    if not staff_ok and row['password'] != data['password']:
        conn.close()
        return jsonify({'error': '비밀번호 불일치'}), 403
    cur.execute('DELETE FROM success_stories WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'result': 'success'})

# --- 기존 동물 게시판 API ---
@app.route('/api/posts', methods=['GET'])
def get_posts():
    """
    등록된 모든 게시물 목록을 반환합니다.
    """
    return jsonify(posts)

@app.route('/api/posts', methods=['POST'])
def add_post():
    """
    게시물 등록 (프론트에서 JSON으로 전송)
    """
    data = request.get_json()
    required = ['postType', 'petType', 'breed', 'gender', 'color', 'address', 'contactName', 'contactPhone', 'photoUrl', 'date']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': '필수 항목 누락'}), 400
    mod = _moderation_block_response(
        data.get('postType'),
        data.get('petType'),
        data.get('breed'),
        data.get('gender'),
        data.get('color'),
        data.get('address'),
        data.get('contactName'),
        data.get('description'),
    )
    if mod is not None:
        return mod
    from datetime import datetime
    data['id'] = int(datetime.now().timestamp() * 1000)
    data['createdAt'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    posts.insert(0, data)
    return jsonify({'result': 'success', 'post': data}), 201

@app.route('/api/telegram/status', methods=['GET'])
def telegram_status():
    """텔레그램 연동 상태 (비밀 값 미노출)."""
    return jsonify({
        'default_channel_configured': is_telegram_configured(),
        'bot_token_set': is_telegram_bot_configured(),
        'region_routes_file': has_region_routes_file(),
        'subscriber_count': subscriber_count(),
    })


@app.route('/api/telegram/webhook/<secret>', methods=['POST'])
def telegram_webhook(secret):
    """
    BotFather /setWebhook URL 에 넣을 주소 예:
    https://도메인/api/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET 와 동일한 문자열>
    """
    expected = os.environ.get('TELEGRAM_WEBHOOK_SECRET', '').strip()
    if not expected or secret != expected:
        return '', 403
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return '', 400
    if not data:
        return '', 400
    try:
        process_telegram_update(data)
    except Exception:
        pass
    return jsonify({'ok': True})

@app.route('/')
def root():
    return send_from_directory('static', 'index.html')


@app.route('/index.html')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/community.html')
def serve_community():
    # 실제 파일은 backend/static/ 아래에 있음
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'community.html')

@app.route('/lost-pets.html')
def serve_lost_pets():
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'lost-pets.html')

@app.route('/found-pets.html')
def serve_found_pets():
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'found-pets.html')

@app.route('/success-stories.html')
def serve_success_stories():
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'success-stories.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    # 실제 파일은 backend/static/css/
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static', 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    # 실제 파일은 backend/static/js/
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'static', 'js'), filename)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))
    url = f'/uploads/{filename}'
    return jsonify({'url': url})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    import os
    # 로컬 기본 8765 (5000/8080 충돌 회피). 배포는 PORT 환경변수로 덮어씀.
    port = int(os.environ.get('PORT', 8765))
    app.run(debug=True, host='0.0.0.0', port=port) 
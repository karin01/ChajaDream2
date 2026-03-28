# 봇 명령용: SQLite 에서 기존 게시글 목록·상세 조회 (Flask 와 동일 community.db)
import os
import sqlite3

from telegram_notify import (
    PET_TYPE_KO,
    GENDER_KO,
    absolute_photo_url_from_str,
    _public_base_url,
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "community.db")
LIST_PAGE_SIZE = 8


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _web_hint() -> str:
    base = _public_base_url()
    if base:
        return f"전체는 웹에서 보기: {base}"
    return "전체는 웹에서 확인하세요. (.env PUBLIC_BASE_URL 이면 링크가 더 정확해요.)"


def format_lost_list_page(page: int) -> str:
    """실종 글 목록 1페이지 (평문)."""
    page = max(1, int(page))
    offset = (page - 1) * LIST_PAGE_SIZE
    conn = _conn()
    try:
        total = conn.execute("SELECT COUNT(*) AS c FROM lost_pets").fetchone()["c"]
        rows = conn.execute(
            "SELECT id, petType, breed, petName, address, lostDate FROM lost_pets ORDER BY id DESC LIMIT ? OFFSET ?",
            (LIST_PAGE_SIZE, offset),
        ).fetchall()
    finally:
        conn.close()

    if total == 0:
        return "아직 등록된 실종 글이 없습니다."

    lines = [
        f"🚨 실종 게시글 (최신순) — {offset + 1}~{min(offset + LIST_PAGE_SIZE, total)} / 전체 {total}건",
        "상세(사진 포함): /lostid 번호  또는  /실종글 번호",
        "",
    ]
    for r in rows:
        d = dict(r)
        pt = PET_TYPE_KO.get(str(d.get("petType")), d.get("petType") or "?")
        addr = (d.get("address") or "")[:28]
        breed_txt = d.get("breed") or "-"
        # DB 컬럼명 대소문자·별칭 호환 (구버전 Row)
        nm = (d.get("petName") or d.get("petname") or "").strip()
        date_txt = d.get("lostDate") or "-"
        # 반려동물 이름은 목록에서도 바로 보이게 파이프 구분 + '이름:' 라벨
        if nm:
            line1 = f"#{d['id']} | {pt} | {breed_txt} | 이름:{nm} | {date_txt}"
        else:
            line1 = f"#{d['id']} | {pt} | {breed_txt} | {date_txt}"
        lines.append(f"{line1}\n   📍 {addr}…")
    max_page = (total + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE
    lines.append("")
    if page < max_page:
        lines.append(f"다음: /lost {page + 1}  또는  /실종 {page + 1}")
    if page > 1:
        lines.append(f"이전: /lost {page - 1}")
    lines.append(_web_hint() + " → /lost-pets.html")
    return "\n".join(lines)


def format_lost_detail(post_id: int) -> tuple[str, str | None]:
    """(상세 평문, 사진 URL). 연락처 제외."""
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM lost_pets WHERE id = ?", (post_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        return (f"실종 글 #{post_id} 은(는) 없습니다.", None)
    d = dict(row)
    pt = PET_TYPE_KO.get(str(d.get("petType")), d.get("petType") or "-")
    g = GENDER_KO.get(str(d.get("gender")), d.get("gender") or "-")
    lines = [
        f"🚨 실종 #{post_id}",
        f"동물 종류: {pt}",
        f"품종: {d.get('breed') or '-'}",
        f"성별: {g}",
    ]
    pn = (d.get("petName") or "").strip()
    if pn:
        lines.append(f"이름: {pn}")
    if d.get("age"):
        lines.append(f"나이: {d['age']}")
    lines.append(f"털색 및 특징: {d.get('color') or '-'}")
    if d.get("description"):
        lines.append(f"기타: {d['description'][:200]}{'…' if len(d.get('description') or '') > 200 else ''}")
    lines.append(f"실종 날짜: {d.get('lostDate') or '-'}")
    if d.get("lostTime"):
        lines.append(f"실종 시간: {d['lostTime']}")
    lines.append(f"실종 장소: {d.get('address') or '-'}")
    lines.append("")
    lines.append("※ 연락처는 개인정보 보호로 텔레그램에 표시하지 않습니다. 웹에서 확인해 주세요.")
    base = _public_base_url()
    if base:
        lines.append(f"웹: {base}/lost-pets.html")
    photo = absolute_photo_url_from_str(d.get("photoUrl"))
    return "\n".join(lines), photo


def format_found_list_page(page: int) -> str:
    page = max(1, int(page))
    offset = (page - 1) * LIST_PAGE_SIZE
    conn = _conn()
    try:
        total = conn.execute("SELECT COUNT(*) AS c FROM found_pets").fetchone()["c"]
        rows = conn.execute(
            "SELECT id, petType, breed, petName, address, foundDate FROM found_pets ORDER BY id DESC LIMIT ? OFFSET ?",
            (LIST_PAGE_SIZE, offset),
        ).fetchall()
    finally:
        conn.close()

    if total == 0:
        return "아직 등록된 발견 글이 없습니다."

    lines = [
        f"📌 발견 게시글 — {offset + 1}~{min(offset + LIST_PAGE_SIZE, total)} / 전체 {total}건",
        "상세: /foundid 번호  또는  /발견글 번호",
        "",
    ]
    for r in rows:
        d = dict(r)
        pt = PET_TYPE_KO.get(str(d.get("petType")), d.get("petType") or "?")
        addr = (d.get("address") or "")[:28]
        breed_txt = d.get("breed") or "-"
        nm = (d.get("petName") or d.get("petname") or "").strip()
        date_txt = d.get("foundDate") or "-"
        if nm:
            line1 = f"#{d['id']} | {pt} | {breed_txt} | 이름:{nm} | {date_txt}"
        else:
            line1 = f"#{d['id']} | {pt} | {breed_txt} | {date_txt}"
        lines.append(f"{line1}\n   📍 {addr}…")
    max_page = (total + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE
    lines.append("")
    if page < max_page:
        lines.append(f"다음: /found {page + 1}  또는  /발견 {page + 1}")
    if page > 1:
        lines.append(f"이전: /found {page - 1}")
    lines.append(_web_hint() + " → /found-pets.html")
    return "\n".join(lines)


def format_found_detail(post_id: int) -> tuple[str, str | None]:
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM found_pets WHERE id = ?", (post_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        return (f"발견 글 #{post_id} 은(는) 없습니다.", None)
    d = dict(row)
    pt = PET_TYPE_KO.get(str(d.get("petType")), d.get("petType") or "-")
    g = GENDER_KO.get(str(d.get("gender")), d.get("gender") or "-")
    lines = [
        f"📌 발견 #{post_id}",
        f"동물 종류: {pt}",
        f"품종: {d.get('breed') or '-'}",
        f"성별: {g}",
    ]
    pn = (d.get("petName") or d.get("petname") or "").strip()
    if pn:
        lines.append(f"이름: {pn}")
    if d.get("age"):
        lines.append(f"나이: {d['age']}")
    lines.append(f"털색 및 특징: {d.get('color') or '-'}")
    if d.get("description"):
        lines.append(f"기타: {d['description'][:200]}{'…' if len(d.get('description') or '') > 200 else ''}")
    lines.append(f"발견 날짜: {d.get('foundDate') or '-'}")
    if d.get("foundTime"):
        lines.append(f"발견 시간: {d['foundTime']}")
    lines.append(f"발견 장소: {d.get('address') or '-'}")
    lines.append("")
    lines.append("※ 연락처는 웹에서만 확인해 주세요.")
    base = _public_base_url()
    if base:
        lines.append(f"웹: {base}/found-pets.html")
    photo = absolute_photo_url_from_str(d.get("photoUrl"))
    return "\n".join(lines), photo


def format_community_list_page(page: int) -> str:
    page = max(1, int(page))
    offset = (page - 1) * LIST_PAGE_SIZE
    conn = _conn()
    try:
        total = conn.execute("SELECT COUNT(*) AS c FROM community").fetchone()["c"]
        rows = conn.execute(
            "SELECT id, title, author, created_at FROM community ORDER BY id DESC LIMIT ? OFFSET ?",
            (LIST_PAGE_SIZE, offset),
        ).fetchall()
    finally:
        conn.close()

    if total == 0:
        return "커뮤니티 글이 없습니다."

    lines = [
        f"💬 커뮤니티 — {offset + 1}~{min(offset + LIST_PAGE_SIZE, total)} / 전체 {total}건",
        "",
    ]
    for r in rows:
        d = dict(r)
        t = (d.get("title") or "")[:40]
        lines.append(f"#{d['id']} | {t} — {d.get('author') or '-'}")
    max_page = (total + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE
    lines.append("")
    if page < max_page:
        lines.append(f"다음: /community {page + 1}  또는  /커뮤 {page + 1}")
    if page > 1:
        lines.append(f"이전: /community {page - 1}")
    lines.append(_web_hint() + " → /community.html")
    return "\n".join(lines)


def format_stories_list_page(page: int) -> str:
    page = max(1, int(page))
    offset = (page - 1) * LIST_PAGE_SIZE
    conn = _conn()
    try:
        total = conn.execute("SELECT COUNT(*) AS c FROM success_stories").fetchone()["c"]
        rows = conn.execute(
            "SELECT id, title, author, created_at FROM success_stories ORDER BY id DESC LIMIT ? OFFSET ?",
            (LIST_PAGE_SIZE, offset),
        ).fetchall()
    finally:
        conn.close()

    if total == 0:
        return "등록된 성공 사례가 없습니다."

    lines = [
        f"⭐ 성공 사례 — {offset + 1}~{min(offset + LIST_PAGE_SIZE, total)} / 전체 {total}건",
        "",
    ]
    for r in rows:
        d = dict(r)
        t = (d.get("title") or "")[:45]
        lines.append(f"#{d['id']} | {t}\n   — {d.get('author') or '-'}")
    max_page = (total + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE
    lines.append("")
    if page < max_page:
        lines.append(f"다음: /story {page + 1}  또는  /사례 {page + 1}")
    if page > 1:
        lines.append(f"이전: /story {page - 1}")
    lines.append(_web_hint() + " → /success-stories.html")
    return "\n".join(lines)


def truncate_telegram_text(text: str, max_len: int = 4000) -> str:
    """sendMessage 한 통 제한 대비."""
    if len(text) <= max_len:
        return text
    return text[: max_len - 20] + "\n…(일부 생략)"

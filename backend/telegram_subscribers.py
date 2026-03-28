# 봇 구독자: 관심 키워드가 실종·발견 게시글 주소 또는 커뮤니티 제목·본문·태그에 포함되면 DM 전송
import os
import sqlite3
from datetime import datetime

_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "community.db")
_MAX_SUBS_PER_USER = 15


def _conn():
    c = sqlite3.connect(_DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def ensure_telegram_subscribers_table() -> None:
    """앱 init_db 외부에서도 호출 가능하도록 안전하게 CREATE."""
    conn = _conn()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS telegram_subscribers (
                telegram_user_id INTEGER NOT NULL,
                chat_id TEXT NOT NULL,
                region_keyword TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, region_keyword)
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def subscriber_count() -> int:
    ensure_telegram_subscribers_table()
    conn = _conn()
    try:
        row = conn.execute("SELECT COUNT(*) AS n FROM telegram_subscribers").fetchone()
        return int(row["n"]) if row else 0
    finally:
        conn.close()


def add_subscription(telegram_user_id: int, chat_id: str, region_keyword: str) -> tuple[bool, str]:
    """구독 추가. (성공 여부, 한글 메시지)"""
    kw = (region_keyword or "").strip()
    if len(kw) < 2:
        return False, "지역 키워드는 2글자 이상 입력해 주세요. 예: /subscribe 강남구"
    if len(kw) > 40:
        return False, "키워드가 너무 깁니다."

    ensure_telegram_subscribers_table()
    conn = _conn()
    try:
        n = conn.execute(
            "SELECT COUNT(*) AS c FROM telegram_subscribers WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()["c"]
        if n >= _MAX_SUBS_PER_USER:
            return False, f"구독은 최대 {_MAX_SUBS_PER_USER}개까지 가능합니다. /list 로 확인 후 /unsubscribe 로 지우세요."

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            """
            INSERT OR REPLACE INTO telegram_subscribers (telegram_user_id, chat_id, region_keyword, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (telegram_user_id, str(chat_id), kw, now),
        )
        conn.commit()
        return (
            True,
            f"알림 구독됨: 「{kw}」\n"
            "실종·발견 글은 장소(주소)에, 커뮤니티 글은 제목·본문·태그에 이 단어가 들어가면 알림을 보냅니다.",
        )
    finally:
        conn.close()


def remove_subscription(telegram_user_id: int, region_keyword: str) -> tuple[bool, str]:
    kw = (region_keyword or "").strip()
    if not kw:
        return False, "예: /unsubscribe 강남구"
    ensure_telegram_subscribers_table()
    conn = _conn()
    try:
        cur = conn.execute(
            "DELETE FROM telegram_subscribers WHERE telegram_user_id = ? AND region_keyword = ?",
            (telegram_user_id, kw),
        )
        conn.commit()
        if cur.rowcount:
            return True, f"구독 해제: 「{kw}」"
        return False, f"「{kw}」 구독이 없습니다. /list 로 확인하세요."
    finally:
        conn.close()


def list_subscriptions(telegram_user_id: int) -> str:
    ensure_telegram_subscribers_table()
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT region_keyword FROM telegram_subscribers WHERE telegram_user_id = ? ORDER BY region_keyword",
            (telegram_user_id,),
        ).fetchall()
        if not rows:
            return "등록된 구독이 없습니다. /subscribe 강남구 처럼 입력해 보세요."
        lines = [r["region_keyword"] for r in rows]
        return "내 구독 지역:\n" + "\n".join(f"· {x}" for x in lines)
    finally:
        conn.close()


def _matching_chat_ids_from_haystack(haystack: str) -> list[str]:
    """문자열에 구독 키워드가 부분 문자열로 포함되면 chat_id 목록 (중복 제거)."""
    addr = (haystack or "").strip()
    if not addr:
        return []
    compact = addr.replace(" ", "")
    ensure_telegram_subscribers_table()
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT DISTINCT chat_id, region_keyword FROM telegram_subscribers"
        ).fetchall()
    finally:
        conn.close()

    seen: set[str] = set()
    out: list[str] = []
    for row in rows:
        kw = (row["region_keyword"] or "").strip()
        cid = str(row["chat_id"]).strip()
        if not kw or not cid:
            continue
        if kw in addr or kw in compact:
            if cid not in seen:
                seen.add(cid)
                out.append(cid)
    return out


def matching_subscriber_chat_ids(address: str | None) -> list[str]:
    """실종·발견: 주소에 구독 키워드가 부분 문자열로 포함되면 해당 chat_id 목록 (중복 제거)."""
    return _matching_chat_ids_from_haystack((address or "").strip())


def matching_subscriber_chat_ids_for_post_text(*text_parts: str | None) -> list[str]:
    """
    커뮤니티: 제목·본문·태그 등을 한 덩어리로 합쳐 구독 키워드를 찾음.
    매칭 규칙은 주소 필드와 동일(부분 문자열, 공백 제거 문자열에 대한 부분 일치).
    """
    parts: list[str] = []
    for t in text_parts:
        if t is None:
            continue
        s = str(t).strip()
        if s:
            parts.append(s)
    if not parts:
        return []
    return _matching_chat_ids_from_haystack("\n".join(parts))

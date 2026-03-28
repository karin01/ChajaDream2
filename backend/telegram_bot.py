# 텔레그램 봇 명령 처리 (웹훅 또는 poll_telegram_bot.py 에서 호출)
from telegram_notify import _public_base_url, _send_photo_to_chat, send_telegram_plain_sync
from telegram_subscribers import (
    add_subscription,
    list_subscriptions,
    remove_subscription,
)


def _web_register_link_message(kind: str) -> str:
    """옵션 B: 텔레그램에서는 링크만 안내, 실제 등록은 웹(?register=1)에서."""
    if kind == "lost":
        path = "/lost-pets.html?register=1"
        label = "실종 동물"
    else:
        path = "/found-pets.html?register=1"
        label = "발견 동물"
    base = _public_base_url()
    if base:
        url = f"{base}{path}"
        return (
            f"📝 {label} 등록은 웹에서 할 수 있어요.\n"
            f"{url}\n\n"
            "링크를 누르면 등록 창이 자동으로 열립니다."
        )
    return (
        f"📝 {label} 등록 페이지 경로:\n{path}\n\n"
        "전체 주소를 만들려면 서버 .env 에 PUBLIC_BASE_URL=https://실제도메인 형태로 설정해 주세요.\n"
        "PC에서 직접 접속할 때는 브라우저 주소창에 위 경로를 붙여 여세요."
    )


def _help_text() -> str:
    return (
        "🐾 반려동물 차자드림 알림 봇\n"
        "└ ‘── 기존 글 보기 ─’ 줄이 안 보이면 → 폴링 창(ChajaDream-Telegram)과 서버를 껐다가 서버실행.bat 으로 다시 켜 주세요.\n\n"
        "── 구독 ──\n"
        "/subscribe 또는 /구독 강남구 — 실종·발견은 주소, 커뮤니티는 제목·본문·태그에 단어가 들어가면 알림\n"
        "/unsubscribe 또는 /구독해제 강남구 — 구독 해제\n"
        "/list — 내 구독 목록\n\n"
        "── 웹에서 글 등록 (링크 열기) ──\n"
        "/실종등록 또는 /lostreg — 실종 등록 페이지\n"
        "/발견등록 또는 /foundreg — 발견 등록 페이지\n\n"
        "── 기존 글 보기 (웹 DB와 동일, 페이지당 8건) ──\n"
        "/lost 또는 /실종 [페이지] — 실종 목록\n"
        "/lostid 5 또는 /실종글 5 — 실종 글 상세\n"
        "/found 또는 /발견 [페이지] — 발견 목록\n"
        "/foundid 5 또는 /발견글 5 — 발견 상세\n"
        "/community 또는 /커뮤 [페이지] — 커뮤니티 목록\n"
        "/story 또는 /사례 [페이지] — 성공 사례 목록\n\n"
        "※ 개인정보 보호를 위해 연락처는 알림에 포함되지 않습니다.\n"
        "※ 웹에 올린 사진은 텔레그램에서 보려면 PUBLIC_BASE_URL 이 인터넷에서 열리는 주소여야 합니다."
    )


def _send_detail_plain_with_photo(chat_id_str: str, body: str, photo_url: str | None) -> None:
    """상세 본문 + 선택 사진(있으면 sendPhoto 후 텍스트)."""
    from telegram_browse import truncate_telegram_text

    body = truncate_telegram_text(body)
    if photo_url:
        ok = _send_photo_to_chat(chat_id_str, photo_url, "📷 게시글 사진", html=False)
        if not ok:
            body = body + f"\n\n(사진: {photo_url})"
    send_telegram_plain_sync(chat_id_str, body)


def process_telegram_update(update: dict) -> None:
    """Telegram Update JSON 하나 처리."""
    msg = update.get("message") or update.get("edited_message")
    if not msg or "text" not in msg:
        return
    text_raw = (msg.get("text") or "").strip()
    if not text_raw:
        return

    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return
    chat_id_str = str(chat_id)

    from_user = msg.get("from") or {}
    user_id = from_user.get("id")
    if user_id is None:
        return

    parts = text_raw.split(maxsplit=1)
    cmd = parts[0].split("@")[0].lower() if parts else ""
    toks = text_raw.split()

    if cmd in ("/실종등록", "/lostreg", "/lostregister"):
        send_telegram_plain_sync(chat_id_str, _web_register_link_message("lost"))
        return

    if cmd in ("/발견등록", "/foundreg", "/foundregister"):
        send_telegram_plain_sync(chat_id_str, _web_register_link_message("found"))
        return

    if cmd in ("/lost", "/실종"):
        from telegram_browse import format_lost_list_page

        page = 1
        if len(toks) > 1:
            try:
                page = max(1, int(toks[1]))
            except ValueError:
                page = 1
        send_telegram_plain_sync(chat_id_str, format_lost_list_page(page))
        return

    if cmd in ("/lostid", "/실종글"):
        from telegram_browse import format_lost_detail

        if len(toks) < 2:
            send_telegram_plain_sync(chat_id_str, "예: /lostid 5  또는  /실종글 5")
            return
        try:
            pid = int(toks[1])
        except ValueError:
            send_telegram_plain_sync(chat_id_str, "글 번호는 숫자로 입력해 주세요.")
            return
        text_body, photo = format_lost_detail(pid)
        _send_detail_plain_with_photo(chat_id_str, text_body, photo)
        return

    if cmd in ("/found", "/발견"):
        from telegram_browse import format_found_list_page

        page = 1
        if len(toks) > 1:
            try:
                page = max(1, int(toks[1]))
            except ValueError:
                page = 1
        send_telegram_plain_sync(chat_id_str, format_found_list_page(page))
        return

    if cmd in ("/foundid", "/발견글"):
        from telegram_browse import format_found_detail

        if len(toks) < 2:
            send_telegram_plain_sync(chat_id_str, "예: /foundid 5")
            return
        try:
            pid = int(toks[1])
        except ValueError:
            send_telegram_plain_sync(chat_id_str, "글 번호는 숫자로 입력해 주세요.")
            return
        text_body, photo = format_found_detail(pid)
        _send_detail_plain_with_photo(chat_id_str, text_body, photo)
        return

    if cmd in ("/community", "/커뮤"):
        from telegram_browse import format_community_list_page

        page = 1
        if len(toks) > 1:
            try:
                page = max(1, int(toks[1]))
            except ValueError:
                page = 1
        send_telegram_plain_sync(chat_id_str, format_community_list_page(page))
        return

    if cmd in ("/story", "/사례"):
        from telegram_browse import format_stories_list_page

        page = 1
        if len(toks) > 1:
            try:
                page = max(1, int(toks[1]))
            except ValueError:
                page = 1
        send_telegram_plain_sync(chat_id_str, format_stories_list_page(page))
        return

    if cmd == "/start":
        send_telegram_plain_sync(chat_id_str, _help_text())
        return

    if cmd == "/help":
        send_telegram_plain_sync(chat_id_str, _help_text())
        return

    if cmd == "/list":
        send_telegram_plain_sync(chat_id_str, list_subscriptions(int(user_id)))
        return

    if cmd in ("/subscribe", "/구독"):
        arg = parts[1].strip() if len(parts) > 1 else ""
        ok, reply = add_subscription(int(user_id), chat_id_str, arg)
        send_telegram_plain_sync(chat_id_str, reply)
        return

    if cmd in ("/unsubscribe", "/구독해제"):
        arg = parts[1].strip() if len(parts) > 1 else ""
        ok, reply = remove_subscription(int(user_id), arg)
        send_telegram_plain_sync(chat_id_str, reply)
        return

    # 알 수 없는 메시지는 무시 (스팸 방지)

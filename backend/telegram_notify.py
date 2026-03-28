# 텔레그램 봇 알림 (환경 변수로만 토큰·채팅 ID 설정)
import json
import logging
import os
import threading
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)


def _escape_html(text: str) -> str:
    """Telegram HTML 파싱을 위해 특수문자 이스케이프."""
    if text is None:
        return ""
    s = str(text)
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _public_base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")


def is_telegram_configured() -> bool:
    """커뮤니티 등 기본 채널 알림: 봇 토큰 + TELEGRAM_CHAT_ID 필요."""
    t = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    c = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    return bool(t and c)


def is_telegram_bot_configured() -> bool:
    """지역 라우팅·구독 알림 등: 봇 토큰만 있으면 됨."""
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN", "").strip())


def _send_photo_to_chat(
    chat_id: str,
    photo_url: str,
    caption: str,
    *,
    html: bool = True,
) -> bool:
    """사진 URL 전송. 캡션 최대 1024자(Telegram 제한). 실패 시 False."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or not str(chat_id).strip() or not (photo_url or "").strip():
        return False
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    cap = (caption or "")[:1024]
    payload: dict = {
        "chat_id": str(chat_id).strip(),
        "photo": photo_url.strip(),
        "caption": cap,
    }
    if html:
        payload["parse_mode"] = "HTML"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        logger.warning("텔레그램 sendPhoto HTTP %s: %s", e.code, err_body[:400])
    except Exception as e:
        logger.warning("텔레그램 sendPhoto 실패: %s", e)
    return False


def _split_telegram_text_chunks(text: str, max_len: int = 4080) -> list[str]:
    """sendMessage 본문 최대 4096 → 여러 통으로 나눔."""
    if len(text) <= max_len:
        return [text]
    chunks: list[str] = []
    lines = text.split("\n")
    buf: list[str] = []
    cur_len = 0
    for line in lines:
        line_len = len(line) + (1 if buf else 0)
        if cur_len + line_len > max_len and buf:
            chunks.append("\n".join(buf))
            buf = [line]
            cur_len = len(line)
        else:
            buf.append(line)
            cur_len += line_len
    if buf:
        chunks.append("\n".join(buf))
    # 한 줄이 max_len 초과 시 억지 분할
    fixed: list[str] = []
    for c in chunks:
        if len(c) <= max_len:
            fixed.append(c)
            continue
        for i in range(0, len(c), max_len):
            fixed.append(c[i : i + max_len])
    return fixed


def _send_sync_to_chat(chat_id: str, text: str, *, html: bool = True) -> None:
    """특정 chat_id로 동기 전송 (내부용)."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or not (chat_id or "").strip():
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload: dict = {
        "chat_id": str(chat_id).strip(),
        "text": text,
        "disable_web_page_preview": True,
    }
    if html:
        payload["parse_mode"] = "HTML"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status != 200:
                logger.warning("텔레그램 응답 HTTP %s", resp.status)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        logger.warning("텔레그램 HTTP 오류 %s: %s", e.code, err_body[:500])
    except Exception as e:
        logger.warning("텔레그램 전송 실패: %s", e)


def _send_sync(text: str) -> None:
    """기본 TELEGRAM_CHAT_ID 로 전송 (커뮤니티 알림용)."""
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    _send_sync_to_chat(chat_id, text, html=True)


def send_telegram_plain_sync(chat_id: str, text: str) -> bool:
    """봇 응답용 일반 텍스트 (HTML 비사용). 성공 시 True."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or not str(chat_id).strip():
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": str(chat_id).strip(),
        "text": text,
        "disable_web_page_preview": True,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception as e:
        logger.warning("텔레그램 응답 전송 실패: %s", e)
        return False


def notify_telegram(text: str) -> None:
    """
    기본 채팅(TELEGRAM_CHAT_ID)으로만 전송 — 커뮤니티 찾는다/임보 알림 등.
    """
    if not is_telegram_configured():
        return
    thread = threading.Thread(target=_send_sync, args=(text,), daemon=True)
    thread.start()


def notify_telegram_routed(
    text: str,
    address: str | None,
    *,
    photo_url: str | None = None,
    photo_caption: str | None = None,
) -> None:
    """
    실종/발견 글: 주소 기준 지역 채널(telegram_regions.json) + 구독자 DM.
    수신 chat_id 가 하나도 없으면 전송하지 않음.

    photo_url: http(s) 이미지면 sendPhoto로 먼저 전송(캡션 1024자 제한). 상세 본문은 text로 이어서 전송.
    """
    if not is_telegram_bot_configured():
        return
    from telegram_routing import resolve_all_target_chat_ids
    from telegram_subscribers import matching_subscriber_chat_ids

    addr = address or ""
    ids_ch = list(
        dict.fromkeys(resolve_all_target_chat_ids(addr) + matching_subscriber_chat_ids(addr))
    )
    if not ids_ch:
        return

    chunks = _split_telegram_text_chunks(text, 4080)
    photo = (photo_url or "").strip()
    if photo and not (photo.startswith("http://") or photo.startswith("https://")):
        photo = ""
    cap = (photo_caption or "").strip()[:1024]

    def _run() -> None:
        for cid in ids_ch:
            if photo:
                ok = _send_photo_to_chat(cid, photo, cap, html=True)
                if not ok:
                    logger.warning("sendPhoto 실패 — 본문만 전송 chat_id=%s", cid[:6])
            for part in chunks:
                _send_sync_to_chat(cid, part, html=True)

    threading.Thread(target=_run, daemon=True).start()


def format_community_keyword_subscription_notification(data: dict, post_id: int) -> str:
    """커뮤니티 글에 구독 키워드가 매칭됐을 때 DM용 HTML 본문."""
    base = _public_base_url()
    lines = [
        "🔔 <b>[반려동물 차자드림] 커뮤니티 구독 키워드 알림</b>",
        "구독 중인 키워드가 새 글(제목·본문·태그)에 포함되었습니다.",
        f"글 번호: #{post_id}",
        f"제목: {_escape_html(data.get('title', ''))}",
        f"작성자: {_escape_html(data.get('author', ''))}",
    ]
    tags = data.get("tags", "")
    if tags:
        lines.append(f"태그: {_escape_html(str(tags))}")
    preview = str(data.get("content", "") or "").strip()
    if preview:
        max_len = 280
        if len(preview) > max_len:
            preview = preview[:max_len] + "…"
        lines.append(f"미리보기: {_escape_html(preview)}")
    if base:
        safe_url = _escape_html(f"{base}/community.html")
        lines.append(f'<a href="{safe_url}">웹에서 보기</a>')
    else:
        lines.append("(배포 시 .env 의 PUBLIC_BASE_URL 을 설정하면 링크가 표시됩니다.)")
    return "\n".join(lines)


def notify_community_keyword_subscribers(data: dict, post_id: int) -> None:
    """
    커뮤니티 신규 글: 제목·본문·태그에 /subscribe 키워드가 포함된 사용자에게 DM.
    실종·발견의 주소 매칭과 같은 DB·규칙을 쓰며, 별도 스레드에서 전송합니다.
    """
    if not is_telegram_bot_configured():
        return
    from telegram_subscribers import matching_subscriber_chat_ids_for_post_text

    ids_ch = matching_subscriber_chat_ids_for_post_text(
        data.get("title"),
        data.get("content"),
        data.get("tags"),
    )
    if not ids_ch:
        return

    text = format_community_keyword_subscription_notification(data, post_id)
    chunks = _split_telegram_text_chunks(text, 4080)
    photo = _photo_url_for_telegram(data)
    cap_lines = [
        f"🔔 <b>커뮤니티 구독 알림 · 글 #{post_id}</b>",
    ]
    base = _public_base_url()
    if base:
        cu = _escape_html(f"{base}/community.html")
        cap_lines.append(f'<a href="{cu}">게시판에서 보기</a>')
    cap_lines.append("<i>상세는 아래 메시지를 확인하세요.</i>")
    caption = "\n".join(cap_lines)

    def _run() -> None:
        for cid in ids_ch:
            if photo:
                ok = _send_photo_to_chat(cid, photo, caption, html=True)
                if not ok:
                    logger.warning(
                        "커뮤니티 구독 알림 sendPhoto 실패 — 본문만 전송 chat_id=%s",
                        cid[:6] if len(cid) >= 6 else cid,
                    )
            for part in chunks:
                _send_sync_to_chat(cid, part, html=True)

    threading.Thread(target=_run, daemon=True).start()


# 동물 종류·성별 코드 → 한글 (실종/발견 알림용)
PET_TYPE_KO = {"dog": "강아지", "cat": "고양이", "etc": "기타"}
GENDER_KO = {"male": "수컷", "female": "암컷", "unknown": "미상"}


def absolute_photo_url_from_str(photo_field: str | None) -> str | None:
    """
    DB 등에 저장된 photoUrl 한 칸 → 텔레그램이 GET 할 수 있는 절대 URL.
    `/uploads/...` 는 PUBLIC_BASE_URL 과 이어 붙임. 공인 주소 미설정·로컬만이면 None 될 수 있음.
    """
    raw = (photo_field or "").strip()
    if not raw:
        return None
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    base = _public_base_url()
    if not base:
        return None
    path = raw if raw.startswith("/") else f"/{raw}"
    return f"{base}{path}"


def _photo_url_for_telegram(data: dict) -> str | None:
    """알림용: 게시글 dict 에서 사진 절대 URL."""
    return absolute_photo_url_from_str(data.get("photoUrl"))


def format_lost_pet_notification(data: dict, post_id: int) -> tuple[str, str | None, str]:
    """
    실종 동물 등록 알림 (연락처는 알림에 넣지 않음).
    반환: (전체 본문 HTML, 사진 URL 또는 None, sendPhoto용 짧은 캡션 HTML)
    """
    base = _public_base_url()
    pt = PET_TYPE_KO.get(str(data.get("petType", "")), data.get("petType", "") or "-")
    g = GENDER_KO.get(str(data.get("gender", "")), data.get("gender", "") or "-")
    lines = [
        "🚨 <b>[반려동물 차자드림] 실종 동물 새 글</b>",
        f"글 번호: #{post_id}",
        f"동물 종류: {_escape_html(pt)}",
        f"품종: {_escape_html(str(data.get('breed', '') or '-'))}",
        f"성별: {_escape_html(g)}",
    ]
    pname = (data.get("petName") or "").strip()
    if pname:
        lines.append(f"이름: {_escape_html(pname)}")
    age = data.get("age")
    if age:
        lines.append(f"나이: {_escape_html(str(age))}")
    lines.append(f"털색 및 특징: {_escape_html(str(data.get('color', '') or '-'))}")
    desc = data.get("description", "")
    if desc:
        lines.append(f"기타 특이사항: {_escape_html(str(desc))}")
    lines.append(f"실종 날짜: {_escape_html(str(data.get('lostDate', '') or '-'))}")
    lt = data.get("lostTime", "")
    if lt:
        lines.append(f"실종 시간: {_escape_html(str(lt))}")
    lines.append(f"실종 장소: {_escape_html(str(data.get('address', '') or '-'))}")
    lines.append("")
    lines.append("※ 연락처는 개인정보 보호를 위해 알림에 포함되지 않습니다. 웹에서 확인해 주세요.")
    if base:
        safe_url = _escape_html(f"{base}/lost-pets.html")
        lines.append(f'<a href="{safe_url}">웹에서 실종 게시판 보기</a>')
    else:
        lines.append("(배포 시 .env 의 PUBLIC_BASE_URL 을 설정하면 링크가 표시됩니다.)")

    body = "\n".join(lines)
    photo = _photo_url_for_telegram(data)
    cap_lines = [f"🚨 <b>실종 새 글 #{post_id}</b>"]
    if base:
        cu = _escape_html(f"{base}/lost-pets.html")
        cap_lines.append(f'<a href="{cu}">게시판에서 보기</a>')
    cap_lines.append("<i>상세는 아래 메시지를 확인하세요.</i>")
    caption = "\n".join(cap_lines)
    return body, photo, caption


def format_found_pet_notification(data: dict, post_id: int) -> tuple[str, str | None, str]:
    """발견 동물 등록 알림. 반환: (본문, 사진 URL, 캡션)"""
    base = _public_base_url()
    pt = PET_TYPE_KO.get(str(data.get("petType", "")), data.get("petType", "") or "-")
    g = GENDER_KO.get(str(data.get("gender", "")), data.get("gender", "") or "-")
    lines = [
        "📌 <b>[반려동물 차자드림] 발견 동물 새 글</b>",
        f"글 번호: #{post_id}",
        f"동물 종류: {_escape_html(pt)}",
        f"품종: {_escape_html(str(data.get('breed', '') or '-'))}",
        f"성별: {_escape_html(g)}",
    ]
    pname = (data.get("petName") or "").strip()
    if pname:
        lines.append(f"이름: {_escape_html(pname)}")
    age = data.get("age")
    if age:
        lines.append(f"나이: {_escape_html(str(age))}")
    lines.append(f"털색 및 특징: {_escape_html(str(data.get('color', '') or '-'))}")
    desc = data.get("description", "")
    if desc:
        lines.append(f"기타 특이사항: {_escape_html(str(desc))}")
    lines.append(f"발견 날짜: {_escape_html(str(data.get('foundDate', '') or '-'))}")
    ft = data.get("foundTime", "")
    if ft:
        lines.append(f"발견 시간: {_escape_html(str(ft))}")
    lines.append(f"발견 장소: {_escape_html(str(data.get('address', '') or '-'))}")
    lines.append("")
    lines.append("※ 연락처는 개인정보 보호를 위해 알림에 포함되지 않습니다.")
    if base:
        safe_url = _escape_html(f"{base}/found-pets.html")
        lines.append(f'<a href="{safe_url}">웹에서 발견 게시판 보기</a>')
    else:
        lines.append("(배포 시 PUBLIC_BASE_URL 설정 시 링크가 표시됩니다.)")

    body = "\n".join(lines)
    photo = _photo_url_for_telegram(data)
    cap_lines = [f"📌 <b>발견 새 글 #{post_id}</b>"]
    if base:
        cu = _escape_html(f"{base}/found-pets.html")
        cap_lines.append(f'<a href="{cu}">게시판에서 보기</a>')
    cap_lines.append("<i>상세는 아래 메시지를 확인하세요.</i>")
    caption = "\n".join(cap_lines)
    return body, photo, caption


def detect_chajunda_imbo_labels(data: dict) -> list[str]:
    """
    제목·본문·태그에서 커뮤니티 텔레그램 알림 대상이 되는 키워드를 찾습니다.
    - 「실종」「발견」 문자 포함
    - 입양·가족 찾기 성격(찾는다 계열), 임시보호·임보
    """
    title = str(data.get("title", "") or "")
    content = str(data.get("content", "") or "")
    tags = str(data.get("tags", "") or "")
    blob = f"{title}\n{content}\n{tags}"

    labels: list[str] = []

    # 임시보호·임보
    if any(k in blob for k in ("임시보호", "임시 보호", "임보")):
        labels.append("임보")

    # 실종·발견 (웹 안내 문구와 동일한 기준)
    if "실종" in blob:
        labels.append("실종")
    if "발견" in blob:
        labels.append("발견")

    # 가족·보호자를 찾는 글 (찾는다 계열)
    chajunda_keys = (
        "찾는다",
        "가족을 찾",
        "가족 찾아",
        "가족찾아",
        "가족구해",
        "집사를 찾",
        "집사 찾아",
        "보호자를 찾",
        "보호자 찾아",
        "입양 보내",
        "입양합니다",
        "입양 해요",
        "입양가능",
        "입양 가능",
        "입양 구합니다",
        "입양구합니다",
        "새 가족",
        "새가족",
    )
    if any(k in blob for k in chajunda_keys):
        labels.append("찾는다")

    # 순서 유지·중복 제거
    seen: set[str] = set()
    out: list[str] = []
    for L in labels:
        if L not in seen:
            seen.add(L)
            out.append(L)
    return out


def format_chajunda_imbo_community_notification(
    data: dict, post_id: int, labels: list[str]
) -> str:
    """커뮤니티 글 텔레그램 본문 (실종·발견·찾는다·임보 등 라벨)."""
    base = _public_base_url()
    kind = " · ".join(_escape_html(x) for x in labels)
    lines = [
        f"🔔 <b>[반려동물 차자드림] {kind} 알림</b>",
        f"글 번호: #{post_id}",
        f"제목: {_escape_html(data.get('title', ''))}",
        f"작성자: {_escape_html(data.get('author', ''))}",
    ]
    tags = data.get("tags", "")
    if tags:
        lines.append(f"태그: {_escape_html(str(tags))}")
    preview = str(data.get("content", "") or "").strip()
    if preview:
        max_len = 280
        if len(preview) > max_len:
            preview = preview[:max_len] + "…"
        lines.append(f"미리보기: {_escape_html(preview)}")
    if base:
        safe_url = _escape_html(f"{base}/community.html")
        lines.append(f'<a href="{safe_url}">웹에서 보기</a>')
    return "\n".join(lines)

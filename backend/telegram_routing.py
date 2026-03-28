# 주소 문자열 → 지역별 텔레그램 chat_id 매칭 (외부 지오코딩 API 없이 키워드 포함 여부)
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_REGIONS_FILE = os.path.join(_BACKEND_DIR, "telegram_regions.json")


def load_region_routes() -> list[dict[str, Any]]:
    """telegram_regions.json 의 routes 배열 로드. 없거나 오류 시 빈 목록."""
    if not os.path.isfile(_REGIONS_FILE):
        return []
    try:
        with open(_REGIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        routes = data.get("routes") or []
        if not isinstance(routes, list):
            return []
        return [r for r in routes if isinstance(r, dict) and r.get("chat_id") and r.get("keywords")]
    except Exception as e:
        logger.warning("telegram_regions.json 로드 실패: %s", e)
        return []


def has_region_routes_file() -> bool:
    return os.path.isfile(_REGIONS_FILE)


def resolve_region_chat_ids(address: str) -> list[str]:
    """
    주소에 routes[].keywords 중 하나라도 포함되면 해당 chat_id 수집.
    공백 제거 버전 주소도 함께 검사.
    """
    addr = (address or "").strip()
    if not addr:
        return []
    addr_compact = addr.replace(" ", "").replace("\n", "")
    seen: set[str] = set()
    out: list[str] = []
    for route in load_region_routes():
        chat_id = str(route["chat_id"]).strip()
        keywords = route.get("keywords") or []
        if not isinstance(keywords, list):
            continue
        for kw in keywords:
            if not kw or not isinstance(kw, str):
                continue
            k = kw.strip()
            if not k or k.startswith("_"):
                continue
            if k in addr or k in addr_compact:
                if chat_id not in seen:
                    seen.add(chat_id)
                    out.append(chat_id)
                break
    return out


def resolve_all_target_chat_ids(address: str | None) -> list[str]:
    """
    실종/발견 알림 수신 chat_id 목록 (중복 제거, 순서 유지).

    - 주소로 매칭된 지역 채널(telegram_regions.json)
    - TELEGRAM_REGION_FALLBACK_DEFAULT 가 true(기본)이면 매칭 0건일 때 TELEGRAM_CHAT_ID
    - TELEGRAM_ALWAYS_SEND_DEFAULT 가 true 이면 지역 매칭이 있어도 TELEGRAM_CHAT_ID 추가
    """
    default = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    fallback = os.environ.get("TELEGRAM_REGION_FALLBACK_DEFAULT", "true").lower() not in (
        "0",
        "false",
        "no",
    )
    always_default = os.environ.get("TELEGRAM_ALWAYS_SEND_DEFAULT", "false").lower() in (
        "1",
        "true",
        "yes",
    )

    regional = resolve_region_chat_ids(address or "")
    result: list[str] = []
    seen: set[str] = set()

    def add(cid: str) -> None:
        if cid and cid not in seen:
            seen.add(cid)
            result.append(cid)

    for cid in regional:
        add(cid)

    if always_default and default:
        add(default)

    if not regional and fallback and default:
        add(default)

    return result

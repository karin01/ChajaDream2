# 사용자 입력 금지어 검사 (욕설·비속어·선정적 표현 등)
# 목록은 필요 시 backend/.env 의 BANNED_WORDS_EXTRA 로 쉼표 구분 추가 가능
from __future__ import annotations

import os
import re
import unicodedata

# 프론트·API 공통 안내 문구
MODERATION_REJECT_MESSAGE = (
    "부적절한 표현(욕설·비속어·선정적 표현 등)이 포함되어 있어 등록할 수 없습니다."
)


def _norm_base(s: str) -> str:
    """유니코드 정규화 + 소문자(라틴)."""
    t = unicodedata.normalize("NFKC", (s or "").strip())
    return t.casefold()


def _compact(s: str) -> str:
    """띄어쓰기·일반 구분 문자 제거(우회 입력 완화)."""
    return re.sub(r"[\s\u00a0\u3000·•\-\._~∙]+", "", s)


def _letters_alnum_hangul(s: str) -> str:
    """기호만 제거한 문자열(시·발 같은 삽입 분리 우회 완화)."""
    return re.sub(r"[^0-9a-z가-힣]", "", s.casefold())


# 반려동물·일상 묘사(「섹시하다」 등) — 금지 목록의 「섹스」와 혼동되거나 BANNED_WORDS_EXTRA 오탐 방지
_ALLOWED_KO_PHRASES: tuple[str, ...] = (
    "섹시하다",
    "섹시해요",
    "섹시합니다",
    "섹시했",
    "섹시해",
    "섹시한",
    "섹시",
)


def _mask_allowed_ko_phrases(text: str) -> str:
    """허용 구문을 치환 문자로 바꿔 금지어 부분일치에서 제외."""
    out = text
    for phrase in sorted(_ALLOWED_KO_PHRASES, key=len, reverse=True):
        out = out.replace(phrase, "\ufffc")
    return out


# 한국어·은어 변형 위주(부분 문자열 일치). 지나치게 짧은 단독 음절은 오탐을 줄이기 위해 제외.
_BANNED_KO: tuple[str, ...] = (
    # 일반 욕설·비속
    "ㅅㅂ",
    "ㅂㅅ",
    "ㄴㅇㅁ",
    "ㄱㅅㄲ",
    "ㅈㄹ",
    "ㅁㅊ",
    "凸",
    "시발",
    "씨발",
    "시팔",
    "씨팔",
    "시벌",
    "씨벌",
    "시빨",
    "씨빨",
    "시부랄",
    "씨부랄",
    "시부럴",
    "씨부럴",
    "시불",
    "씨불",
    "씹",
    "씨끼",
    "ㅆㅂ",
    "sibal",
    "ssibal",
    "tlqkf",
    "fuckyou",
    "개새끼",
    "개새",
    "개쓰레기",
    "개같",
    "개노맛",
    "개씨",
    "개자식",
    "개패",
    "개돼지",
    "개소리",
    "미친놈",
    "미친년",
    "미친넘",
    "미틴",
    "병신",
    "븅신",
    "붕신",
    "등신",
    "느금",
    "느금마",
    "니기미",
    "니미",
    "엠창",
    "엿먹",
    "엿가",
    "엿박",
    "지랄",
    "찌랄",
    "좆",
    "좃",
    "죳",
    "죶",
    "잦",
    "좃나",
    "좆나",
    "좆밥",
    "좆만",
    "자지",
    "잠지",
    "후장",
    "애널",
    "보지",
    "뷩",
    "창녀",
    "창남",
    "창년",
    "걸레",
    "잡년",
    "잡놈",
    "걸레년",
    "씹창",
    "씹치",
    "씹새",
    "씹할",
    "씹테",
    "호로",
    "호냥",
    "섹스",  # 「섹시」·「섹시하다」는 _ALLOWED_KO_PHRASES 로 허용(금지어 아님)
    "ㅅㅅ",
    "porn",
    "porno",
    "야동",
    "포르노",
    "딸딸",
    "자위",
    "벗방",
    "nude",
    "naked",
    "야사",
    "성매매",
    "원조교제",
    "아동포르노",
    "childporn",
    "로리타",
    "강간",
    "성폭행",
    "ㅋㅍ",
    "한녀충",
    "한남충",
    "틀딱",
    "급식충",
    "틀니딱",
)

# 짧은 영어 단어는 단어 경계로만 (class, cockapoo 등 오탐 방지)
_BANNED_EN_PATTERN = re.compile(
    r"(?i)\b("
    r"f+u*c+k+|"
    r"s+h+i+t+|"
    r"b+i+t+c+h+|"
    r"a+s+s+h+o+l+e+|"
    r"d+i+c+k+|"
    r"c+u+n+t+|"
    r"s+l+u+t+|"
    r"w+h+o+r+e+|"
    r"s+e+x+"
    r")\b"
)


def _extra_from_env() -> list[str]:
    raw = os.environ.get("BANNED_WORDS_EXTRA", "").strip()
    if not raw:
        return []
    return [x.strip().casefold() for x in raw.split(",") if len(x.strip()) >= 2]


def moderation_violation_message(*text_parts: str | None) -> str | None:
    """
    주어진 텍스트 조각 중 하나라도 금지 패턴과 맞으면 MODERATION_REJECT_MESSAGE 반환, 아니면 None.
    비밀번호·순수 숫자 전화번호 필드에는 사용하지 않는 것을 권장(오탐·불필요).
    """
    combined = "\n".join(str(p) for p in text_parts if p is not None and str(p).strip() != "")
    if not combined.strip():
        return None

    combined = _mask_allowed_ko_phrases(combined)
    lowered = _norm_base(combined)
    variants = [lowered, _compact(lowered), _letters_alnum_hangul(lowered)]

    phrases = list(_BANNED_KO) + _extra_from_env()
    for blob in variants:
        if not blob:
            continue
        for phrase in phrases:
            if not phrase:
                continue
            p = phrase.casefold() if phrase.isascii() else phrase
            if p in blob:
                return MODERATION_REJECT_MESSAGE

    for blob in variants:
        if blob and _BANNED_EN_PATTERN.search(blob):
            return MODERATION_REJECT_MESSAGE

    return None

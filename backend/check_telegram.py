# 텔레그램 봇 토큰 유효 여부를 getMe API로 확인합니다.
# 사용: backend 폴더에서  py -3 check_telegram.py

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent

try:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND / ".env")
except ImportError:
    pass


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print(
            "[안내] backend/.env 에 TELEGRAM_BOT_TOKEN 을 붙여 넣으세요.\n"
            "  BotFather(https://t.me/BotFather) → /mybots → Chajadream → API Token"
        )
        return 1

    url = f"https://api.telegram.org/bot{token}/getMe"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print("[오류] HTTP", e.code, "- 토큰이 잘못되었거나 만료되었을 수 있습니다.")
        return 1
    except OSError as e:
        print("[오류] 네트워크:", e)
        return 1

    if not data.get("ok"):
        print("[오류] getMe 실패:", data)
        return 1

    u = data.get("result") or {}
    uname = u.get("username") or "?"
    print(f"[성공] 봇 API 연결됨: @{uname} (id={u.get('id')})")

    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if chat_id:
        print(f"[확인] TELEGRAM_CHAT_ID 가 설정되어 있습니다 (길이 {len(chat_id)}). 알림은 해당 채팅으로 전송됩니다.")
    else:
        print(
            "[안내] TELEGRAM_CHAT_ID 가 비어 있습니다. 그룹/채널 알림을 쓰려면 .env 에 채팅 ID 를 넣고 봇을 그 채팅에 추가하세요."
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())

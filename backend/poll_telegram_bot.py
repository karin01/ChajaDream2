"""
HTTPS 없이 로컬에서 봇 명령을 받으려면 이 스크립트를 실행하세요.
getUpdates 롱폴링으로 /subscribe 등을 처리합니다.

  py -3 poll_telegram_bot.py

웹훅을 쓰는 경우(공인 URL + setWebhook)에는 Flask 의 /api/telegram/webhook 만 쓰면 됩니다.
"""
import json
import os
import time
import urllib.error
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

from telegram_bot import process_telegram_update


def _delete_webhook_for_polling(api_base: str) -> None:
    """
    setWebhook 이 남아 있으면 업데이트가 URL로만 가고 getUpdates 가 비게 됩니다.
    로컬 폴링 전에 웹훅을 해제합니다.

    같은 봇을 배포(웹훅)와 로컬에서 동시에 쓰는 경우, 삭제하면 배포 쪽이 멈춥니다.
    그때는 .env 에 TELEGRAM_POLL_NO_DELETE_WEBHOOK=1 을 넣으세요.
    """
    if os.environ.get("TELEGRAM_POLL_NO_DELETE_WEBHOOK", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        print("[텔레그램] TELEGRAM_POLL_NO_DELETE_WEBHOOK 설정됨 → deleteWebhook 생략")
        return
    try:
        url = f"{api_base}/deleteWebhook"
        req = urllib.request.Request(
            url,
            method="POST",
            data=b"{}",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if body.get("ok"):
            print("[텔레그램] 웹훅 해제됨 → getUpdates 폴링 사용 (배포용 웹훅 쓰면 다시 setWebhook 필요)")
        else:
            print("[텔레그램] deleteWebhook 응답:", body)
    except Exception as e:
        print("[텔레그램] deleteWebhook 실패 (무시하고 폴링 시도):", e)


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        env_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(env_dir, ".env")
        print("TELEGRAM_BOT_TOKEN 이 비어 있거나 설정되지 않았습니다.")
        print("(파일은 있어도 등호 뒤에 토큰을 안 붙이면 이 메시지가 납니다.)")
        print("")
        print("설정 파일:", env_path)
        print("1) 텔레그램 @BotFather → /mybots → ChajaDream 봇 → API Token 복사")
        print("2) 메모장으로 .env 열기 → TELEGRAM_BOT_TOKEN= 붙여넣기 (예: 7123456789:AABBccdd...)")
        print("3) 저장 후 이 창 닫고 서버실행.bat 다시 실행")
        input("\n엔터 치면 종료...")
        return
    base = f"https://api.telegram.org/bot{token}"
    _delete_webhook_for_polling(base)
    offset = 0
    print("폴링 시작… (중지: Ctrl+C)")
    print(
        "[차자드림] 텔레그램에서 /help 를 보냈을 때 "
        "'기존 글 보기' 가 보여야 합니다. 구독만 보이면 이 창을 닫고 서버실행.bat 을 다시 실행하세요."
    )
    while True:
        try:
            url = f"{base}/getUpdates?timeout=30&offset={offset}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print("getUpdates 오류:", e)
            time.sleep(3)
            continue
        if not data.get("ok"):
            print("Telegram API 오류:", data)
            time.sleep(3)
            continue
        for upd in data.get("result", []):
            offset = max(offset, int(upd.get("update_id", 0)) + 1)
            try:
                process_telegram_update(upd)
            except Exception as ex:
                print("update 처리 오류:", ex)


if __name__ == "__main__":
    main()

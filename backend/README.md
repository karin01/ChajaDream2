# 반려동물 차자드림 백엔드 (Flask)

## 실행 방법
1. Python 3.x 설치 필요
2. 아래 명령어로 패키지 설치 및 서버 실행
   ```bash
   pip install -r requirements.txt
   python app.py
   ```
3. 로컬 기본 포트: **8765** (`http://localhost:8765`). 배치 파일 또는 `PORT` 환경 변수로 변경. (5000·8080은 다른 프로그램과 겹치기 쉬움)

## 제공 API
- `GET /api/posts` : 동물 게시판 목록 전체 조회
- `POST /api/posts` : 동물 게시판 등록 (JSON)
- `GET /api/community` : 커뮤니티 게시글 목록 조회 (최신순)
- `POST /api/community` : 커뮤니티 글 등록 (제목, 내용, 작성자)

### 커뮤니티 POST 예시
```json
{
  "title": "첫 글입니다!",
  "content": "반려동물 차자드림 커뮤니티에 오신 걸 환영합니다.",
  "author": "홍길동"
}
```

### 커뮤니티 응답 예시
```json
{
  "result": "success",
  "id": 1
}
```

## DB 안내
- `backend/community.db` 파일로 SQLite DB 자동 생성/저장
- 서버 껐다 켜도 커뮤니티 글은 유지됨
- DB 구조: id, title, content, author, created_at

## 텔레그램 알림 연동
- **실종·발견** 글: 주소 문자열을 기준으로 **지역별 그룹(`telegram_regions.json`)** 과 **봇 구독자(`/subscribe`)** 에게 알림을 보냅니다. (봇 토큰 필수)
- **커뮤니티** (글에 **실종·발견** 키워드 또는 찾는다/임보 성격): **`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`** 가 모두 있을 때 기본 채널로 전송합니다.

### 1) 기본 설정
1. [@BotFather](https://t.me/BotFather)에서 봇 생성 후 토큰 복사.
2. `TELEGRAM_CHAT_ID` : 커뮤니티 알림·실종발견 **폴백** 채널 (그룹/채널 ID, 보통 `-100...`).
3. `PUBLIC_BASE_URL` : 배포 URL (알림 속 링크).

### 2) 지역별 채널 (`telegram_regions.json`)
1. `telegram_regions.example.json` 을 복사해 **`telegram_regions.json`** 으로 저장 (Git 제외).
2. `routes` 안에 `keywords`(주소에 포함되면 매칭), `chat_id`(해당 지역 단톡·채널 ID) 를 적습니다.
3. `TELEGRAM_REGION_FALLBACK_DEFAULT=true`(기본): 주소가 어떤 키워드에도 안 맞으면 **`TELEGRAM_CHAT_ID` 한 곳**으로만 전송.  
   `TELEGRAM_ALWAYS_SEND_DEFAULT=true` : 지역 매칭이 있어도 **기본 채널에도 항상** 보냄.

### 3) 사용자 구독 (DM)
1. 사용자가 봇에게 `/start` 후 `/subscribe 강남구` 처럼 **주소에 나올 법한 단어**를 등록합니다.
2. 실종/발견 글의 **주소**에 그 단어가 포함되면 해당 사용자 채팅으로도 동일 알림이 갑니다.
3. **웹훅**(HTTPS 서버): `.env`에 `TELEGRAM_WEBHOOK_SECRET` 설정 후  
   `https://도메인/api/telegram/webhook/<SECRET>` 를 BotFather `setWebhook`에 등록.  
   **로컬만 쓸 때:** 루트 `서버실행.bat` / `run.bat` 가 **자동으로** `poll_telegram_bot.py` 창을 띄웁니다.  
   (Flask만 단독 실행하면 `/start`·`/help`에 봇이 **절대** 답하지 않습니다. 수동: `py -3 poll_telegram_bot.py`)

**봇이 말이 없을 때:**  
- `backend/.env`에 `TELEGRAM_BOT_TOKEN`이 있는지, `py -3 check_telegram.py`로 토큰 확인.  
- **ChajaDream-Telegram** 창이 떠 있는지, `폴링 시작…` 이후 `getUpdates 오류`가 없는지 확인.  
- 예전에 `setWebhook`을 썼다면 폴링이 막힐 수 있음 → 폴링 시작 시 기본으로 `deleteWebhook` 호출. **같은 봇을 이미 웹훅 배포 중**이면 로컬 폴링이 웹훅을 지워 버리므로, 그때만 `.env`에 `TELEGRAM_POLL_NO_DELETE_WEBHOOK=1` (배포와 로컬 동시 사용은 권장하지 않음).

**웹에서 올린 사진을 텔레그램에도:** 업로드 API는 `/uploads/...` 경로만 저장합니다. 알림 시 `PUBLIC_BASE_URL`과 합쳐 절대 URL로 `sendPhoto` 합니다. 따라서 **공인 URL**(실제 도메인 또는 ngrok 등)이 아니면 로컬 `127.0.0.1` 은 텔레그램 서버가 접근할 수 없어 이미지가 안 붙습니다.

### 4) 기존 게시글 둘러보기 (봇 ↔ 같은 SQLite)
- `/help`에 안내된 대로 **`/lost`, `/실종`**, **`/lostid 3`**, **`/found`, `/community`, `/story`** 등으로 `community.db`에 있는 **옛 글까지** 목록·상세 조회 가능합니다.
- 한 메시지 길이 제한 때문에 목록은 **페이지당 8건** (`/lost 2` = 2페이지). “전부 한 통”은 불가능하지만 페이지를 넘기면 전부 볼 수 있습니다.
- 상세의 **연락처는 표시하지 않음**(정책 동일). 성공 사례·커뮤니티는 목록만(본문 길이 이슈).

### 상태 확인
- `GET /api/telegram/status` → `bot_token_set`, `default_channel_configured`, `region_routes_file`, `subscriber_count` 등 JSON 확인.
- 토큰만 빠르게 검증: `backend` 폴더에서 `py -3 check_telegram.py` (`.env`의 `TELEGRAM_BOT_TOKEN`으로 `getMe` 호출).
- 루트 **`텔레그램_ENV편집.bat`**: `backend\.env`를 메모장으로 엶 (토큰 붙여넣기용). `.env` 없으면 `.env.example` 복사.

**보안:** `.env`, `telegram_regions.json` 은 Git에 올리지 마세요.

## 참고
- 모든 코드/응답에 한글 주석, 명확한 변수명 사용
- 동물 게시판은 메모리 방식(서버 재시작 시 초기화)

### POST 예시
```json
{
  "postType": "lost",  // lost(실종) 또는 found(발견)
  "petType": "dog",    // dog, cat, etc
  "breed": "시츄",
  "gender": "male",    // male, female, unknown
  "age": "3살",
  "color": "흰색, 귀 한쪽 접힘",
  "description": "중성화, 겁 많음",
  "date": "2025-06-10",
  "time": "15:00",
  "address": "서울 강남구 역삼동",
  "contactName": "홍길동",
  "contactPhone": "010-1234-5678",
  "photoUrl": "https://placehold.co/400x300"
}
```

### 응답 예시
```json
{
  "result": "success",
  "post": { ... 등록된 게시물 ... }
}
``` 
# 반려동물 차자드림 프로젝트 작업 기록

> 저장 경로 폴더명은 기존과 같이 `ChajaDream2` 입니다.

## 텔레그램 /구독 = /subscribe (2026-03-29)
- `telegram_bot.py`: `process_telegram_update` 에서 `/구독 키워드` 를 `/subscribe` 와 동일 처리. `/help` 문구에 병기.

## 등록 금지어 필터 (2026-03-29)
- `backend/banned_words.py`: 욕설·비속어·선정 표현 등 패턴 검사. 공백·기호 우회 완화( compact / 문자만 추출 변형). 영어는 짧은 단어는 `\b` 정규식으로 오탐 완화.
- `app.py`: 커뮤니티·답글·실종·발견·성공사례·구 `POST /api/posts` 등록/수정 시 본문성 필드에 적용(비밀번호·전화번호 제외).
- `.env` `BANNED_WORDS_EXTRA` 로 쉼표 구분 추가 단어 가능.
- **보완**: 「섹시」「섹시하다」 등 일상·반려동물 묘사용 표현은 금지 목록에 없으며, `BANNED_WORDS_EXTRA`·향후 패턴 오탐 방지를 위해 `_ALLOWED_KO_PHRASES` 로 검사 전 마스킹 처리.

## 운영진 모드 — 실종·발견·성공사례 삭제·수정 (2026-03-29)
- 이전에는 커뮤니티만 `staffSecret` API 연동. 발견/실종/성공사례는 `prompt` 비밀번호만 있어 메인에서 로그인해도 해당 페이지에서 막힘.
- `app.py`: `PUT`/`DELETE` for `lost_pets`, `found_pets`, `success_stories` 에 커뮤니티와 동일한 운영진 분기.
- `lost-pets.html`·`found-pets.html`·`success-stories.html` 에 `staff-mode.js` + 숨은 버튼 + 모달 추가. JS에서 삭제·수정 시 `getStaffSecret()` 있으면 `staffSecret` 전송.

## 커뮤니티 — 답글(댓글) + 운영진 삭제 (2026-03-29)
- **답글**: `community_replies` 테이블. API `GET/POST /api/community/<id>/replies`, `DELETE .../replies/<reply_id>`. 목록 API에 `reply_count` 포함. 상세 모달에서 목록·작성·삭제(답글 비밀번호).
- **운영진 모드**: `backend/.env`에 `STAFF_MODE_SECRET=임의문자열` 설정. 브라우저 `sessionStorage`에 보관해 삭제 요청 시 `staffSecret` 전송. `POST /api/staff/verify`로 확인. 게시글 삭제 시 답글도 함께 삭제.
- 프론트: 공개 체크박스·`prompt()` 제거. **화면 우하단 투명 고정 버튼**만 눌렀을 때 「운영진 전용」모달. 로직 공통화: `static/js/staff-mode.js`. **메인(`index.html`)과 커뮤니티 모두** 동일 UI·동일 `sessionStorage` 키로 로그인 가능.

## 텔레그램 /구독해제 = /unsubscribe (2026-03-29)
- `telegram_bot.py`: `/구독해제 키워드` 를 `/unsubscribe` 와 동일 처리. `/help` 문구에 병기.

## 텔레그램 /subscribe — 커뮤니티도 키워드 매칭 (2026-03-29)
- **증상**: `/subscribe 산책` 후 커뮤니티에 「산책」이 들어간 글을 올렸는데 DM 없음.
- **원인**: 구독 매칭이 실종·발견 **주소 필드**만 대상이었고, 커뮤니티 `POST`는 실종·임보·찾는다 라벨이 있을 때만 기본 채널 `notify_telegram`만 호출함.
- **조치**: `telegram_subscribers.matching_subscriber_chat_ids_for_post_text`로 제목·본문·태그를 합쳐 동일 규칙 매칭. `notify_community_keyword_subscribers`에서 구독 `chat_id`에 DM(+가능 시 사진). `add_community` 성공 후 호출.
- 봇 안내: `add_subscription` 응답·`/help` 에 실종·발견은 주소 / 커뮤니티는 제목·본문·태그임을 명시.

## 성공 사례 — 등록·수정 폼 UI 통일 (2026-03-29)
- `success-stories.html`: `modal-content--lost-form`, `modal-form--stacked`, `modal-form__body` / `__footer`, `modal-form__hint`, 그리드(이전·이후 사진 2열, 작성자·비밀번호 2열)로 실종·발견과 동일 셸.
- `success-stories.js`: 모달 `flex` 표시, 수정 시 비밀번호·파일 입력 초기화, 상세도 `flex`. 수정 PUT 시 빈 사진 URL이면 기존 URL 유지(JS+`app.py`). `UPDATE`에 `author` 반영(이전에는 제목·내용만 갱신).

## 커뮤니티 — 글 수정 (2026-03-29)
- `community.js`: 수정 버튼 → 모달에 제목·내용·작성자·태그 채움, 비밀번호 입력 후 `PUT /api/community/:id`. 새 사진 없으면 목록 캐시의 기존 `photoUrl` 전송.
- `app.py` `update_community`: 빈 `photoUrl`이면 DB 기존 값 유지(실종·발견과 동일).
- 글 작성 시 `tags` 가 API에 안 넘어가던 문제 수정. `community.html` 에 덮어쓰던 디버그 인라인 스크립트 제거(등록 폼이 막히던 원인).

## 모달 — 등록·수정 폼은 배경 클릭으로 닫지 않음 (2026-03-29)
- 실종·발견·성공사례·메인 게시물 등록 모달, `community` 글쓰기 모달: **반투명 바깥 영역 클릭 시 닫힘 제거**, **×(닫기)만** 닫기.
- **상세 보기** 모달은 기존처럼 배경 클릭으로 닫기 유지.

## 수정 시 사진 사라짐 (2026-03-29)
- **원인**: 수정 폼에서 새 파일을 안 고르면 `photoUrl: ""` 로 PUT → DB에서 기존 경로가 덮어써짐.
- **조치**: `lost-pets.js`·`found-pets.js` 에서 새 URL이 없으면 목록에 있는 기존 `photoUrl` 전송. `app.py` PUT 에서도 빈 값이면 `SELECT photoUrl` 유지(이중 방어).

## 텔레그램 → 웹 등록 링크 (옵션 B) (2026-03-28)
- 봇: `/실종등록`·`/lostreg`·`/lostregister`, `/발견등록`·`/foundreg`·`/foundregister` → `PUBLIC_BASE_URL` 이 있으면 전체 URL, 없으면 경로만 안내.
- 웹: `lost-pets.html?register=1`, `found-pets.html?register=1` 로 열리면 등록 모달 자동 표시 후 `register` 쿼리는 `history.replaceState` 로 제거.

## 발견 등록 폼 — 실종과 동일 레이아웃 + 이름 선택 (`petName`) (2026-03-28)
- **폼 UI**: `found-pets.html` 등록·수정 모달을 실종과 같이 `modal-content--lost-form`, `modal-form--stacked`, 상단 그리드(종류/품종/성별/**이름**), 털색, `<details>` 안 나이·발견 시간·기타, 발견 날짜·장소·연락처… 순으로 정리.
- **이름란**: 라벨에 「목걸이·표식 등, 선택」, placeholder 「알 때만 적어 주세요」(필수 아님).
- **DB/API**: `found_pets.petName`, `ALTER` 마이그레이션, `POST`/`PUT` 반영.
- **알림·봇**: `format_found_pet_notification`, `/발견` 목록·상세에 실종과 동일하게 `이름:` 표시.

## 실종 등록 — 반려동물 이름(`petName`) 필드 (2026-03-28)
- **목적**: 성별 옆 빈 칸에 견주가 **이름(애칭)** 을 적을 수 있게 함(선택 입력).
- **DB**: `lost_pets.petName TEXT` — `init_db` 에 컬럼 정의 + 기존 DB용 `ALTER TABLE ... ADD COLUMN`.
- **API**: `POST`/`PUT` `/api/lost-pets` 에 `petName` 저장(공백 trim).
- **텔레그램**: `format_lost_pet_notification`·`telegram_browse` 실종 목록/상세에 이름 표시(값 있을 때만).
- **보완 (같은 날)**: `/실종` 목록 줄에 `| 이름:OOO |` 구간을 넣어 품종 옆에서 이름이 바로 보이게 함. `petname` 키 폴백(구환경).
- **프론트**: `lost-pets.html`·`lost-pets.js`(루트·`backend/static` 동기), 메인 `index.html` 등록 모달·`script.js`(실종일 때만 `petName` 전송).

## 텔레그램 안내 문구 — 커뮤니티 「실종」「발견」 (2026-03-28)
- 메인·커뮤니티: 알림 설명을 「찾는다」「임보」→ **「실종」「발견」** 관련으로 변경. `detect_chajunda_imbo_labels` 에 본문/제목/태그 내 `실종`·`발견` 포함 시 라벨 추가(기존 찾는다·임보 감지 유지).

## 실종·발견 연락처 안내 문구·라벨 (2026-03-28)
- `form-contact-notice`: 동물병원·애견센터·보호시설 대표번호 권장. 실종/발견 등록·수정 폼, 메인 `index` 등록 모달.
- 연락처 라벨에서 `(휴대폰 번호)` 제거 → `연락처`만. placeholder 를 시설 번호 예시로 변경.

## 상세보기 모달 하단 잘림 (2026-03-28)
- 원인: `.modal-content` 가 뷰포트보다 길어져도 **내부 스크롤·max-height** 없어 하단이 화면 밖으로 잘림.
- 조치: `modal-content--detail` + 헤더(닫기) / `modal-content--detail__scroll`(`max-height:90vh`, `overflow-y:auto`, 하단 패딩). `lost-pets`·`found-pets`·`community`·`success-stories`·`index` 상세/게시 모달.

## 텔레그램 /help 가 구독만 보일 때 (2026-03-28)
- 코드에 이미 `기존 글 보기` 블록이 있는데도 예전 도움말이면 **폴링 프로세스가 재시작 안 된 것**. ChajaDream-Telegram 창 종료 후 `서버실행.bat` 재실행.
- `_help_text()` 맨 위에 안내 한 줄·이모지 추가, `poll_telegram_bot.py` 시작 시 콘솔 안내 추가.

## 텔레그램 봇 — 기존 게시물 목록·상세 (`telegram_browse.py`) (2026-03-28)
- `community.db` 직접 조회: `/lost`·`/실종 [페이지]`, `/lostid`·`/실종글`, `/found`·`/발견`, `/foundid`·`/발견글`, `/community`·`/커뮤`, `/story`·`/사례`.
- 페이지당 8건, 상세는 실종·발견만(사진 `absolute_photo_url_from_str`). 커뮤니티·사례는 목록 위주.
- `telegram_notify.absolute_photo_url_from_str` 로 알림용 `_photo_url_for_telegram` 리팩터.

## 텔레그램에 웹 업로드 이미지 — PUBLIC_BASE_URL (2026-03-28)
- 업로드는 `photoUrl=/uploads/...` 저장. `_photo_url_for_telegram`에서 `PUBLIC_BASE_URL + 경로`로 절대 URL 생성 후 `sendPhoto`.
- **127.0.0.1·localhost** 는 텔레그램 서버가 HTTP GET 불가 → 이미지 미표시. **공인 HTTPS 주소**(배포/ngrok) 필요.

## 텔레그램 실종·발견 알림 — 하단 잘림 완화 (2026-03-28)
- **원인 가능성**: (1) 본문이 짧은 형식이라 웹 상세와 다름 (2) 사진+캡션 한 통에만 넣으면 **캡션 1024자**에서 잘림 (3) `sendMessage` **4096자** 초과.
- **조치**: `format_lost_pet_notification` / `format_found_pet_notification` — 웹과 유사한 항목(성별·나이·털색·특이사항·일시·장소) + 맨 아래 안내·웹 링크. `sendPhoto`(짧은 캡션) 후 전체 본문 `sendMessage`, 긴 본문은 `_split_telegram_text_chunks` 로 분할. `PET_TYPE_KO` 웹과 동일(강아지/고양이).

## TELEGRAM_BOT_TOKEN .env 반영 (2026-03-28)
- `backend/.env`에 봇 토큰 저장 후 `check_telegram.py`로 `getMe` 성공 확인(@Chajadream_bot).
- **보안**: 토큰은 채팅/깃에 올리지 말 것. 유출 시 BotFather에서 즉시 **Revoke / 새 토큰** 발급.

## TELEGRAM_BOT_TOKEN 비어 있음 (2026-03-28)
- 터미널: `TELEGRAM_BOT_TOKEN 이 .env 에 없습니다` → 실제로는 `backend\.env`에 **키만 있고 등호 뒤 값이 빈 경우**가 대부분.
- 조치: `@BotFather` → API Token 복사 → `TELEGRAM_BOT_TOKEN=숫자:문자열` 형태로 저장. `텔레그램_ENV편집.bat`로 메모장 열기 가능.
- `poll_telegram_bot.py`: 안내 문구·`.env` 절대 경로·엔터 후 종료.

## 텔레그램 봇 무응답 — 로컬 폴링 자동 실행 (2026-03-28)
- **원인**: `/start` 등은 `process_telegram_update`로만 처리되는데, Flask만 켜 두면 **업데이트를 받는 프로세스가 없음**(웹훅 URL 또는 `getUpdates` 폴링 필요).
- **조치**: `poll_telegram_bot.py` 시작 시 기본 `deleteWebhook`(배포 웹훅과 동시 사용 시 충돌 → `TELEGRAM_POLL_NO_DELETE_WEBHOOK=1`로 생략 가능).
- **조치**: `서버실행.bat`, `backend/run.bat`에서 `ChajaDream-Telegram` 제목 창으로 `poll_telegram_bot.py` 자동 실행 (`cd` 경로에 공백 있어도 되게 `^&^&` 패턴).

## 로컬 기본 포트 8765 (2026-03-28, 8080 충돌 대응)
- Flask `app.py`: `PORT` 미설정 시 기본값 **8765** (5000·8080은 로컬에서 타 프로그램과 충돌하기 쉬움).
- `서버실행.bat`, `backend/run.bat`: `set PORT=8765` — 브라우저 URL도 `%PORT%`로 동일.
- **Docker / Cloud Run**: `backend/Dockerfile`은 여전히 **8080** + `ENV PORT` (컨테이너 내부만 해당, 로컬 배치와 무관).
- `community.js`: 상대 경로 `/api/...` 유지.
- `.env`의 `PUBLIC_BASE_URL`은 로컬에서 `http://127.0.0.1:8765` 등 실제 접속 주소와 맞출 것.

## 서버 실행 배치 — 브라우저 자동 열기 (2026-03-28)
- `서버실행.bat`, `backend/run.bat`: Flask 기동 직후 포트가 올라올 때까지 **약 3초** 대기한 뒤 기본 브라우저로 열기 (`start "" cmd /c "timeout ... && start http://127.0.0.1:%PORT%/"`).
- **이유**: 서버보다 브라우저가 먼저 열리면 연결 거부가 날 수 있어 지연 실행.
- `backend/서버실행.bat`은 `run.bat`를 호출하므로 동일 동작.

## 웹 UI — 텔레그램 연동 안내 문구 (2026-03-28)
- `style.css`: `.telegram-service-note` 공통 박스.
- `index.html`: 본문 섹션 + 푸터 `@Chajadream_bot` 링크 (`https://t.me/Chajadream_bot`).
- `lost-pets.html`, `found-pets.html`, `community.html`, `success-stories.html`: 상단 안내 박스.

## 텔레그램 `.env` 생성·검증 스크립트 (2026-03-28)
- `backend/.env` 가 없어 `load_dotenv`가 아무 것도 안 읽던 상태 → `.env.example` 기반으로 `backend/.env` 생성(값은 사용자가 BotFather에서 채움).
- `backend/check_telegram.py`: `TELEGRAM_BOT_TOKEN`으로 `getMe` 호출해 봇 연결 확인. `py -3 check_telegram.py`

## 텔레그램 봇 연결 (@Chajadream_bot) (2026-03-28)
- 공개 주소 `https://t.me/Chajadream_bot` 은 사용자가 봇을 여는 링크일 뿐, **서버 연동에는 BotFather가 준 API 토큰**이 필요함.
- `backend/.env`: `TELEGRAM_BOT_TOKEN` = BotFather `/token` 값. `TELEGRAM_CHAT_ID` = 알림 받을 그룹/채널 ID (봇을 해당 채팅에 **관리자 또는 멤버**로 추가).
- **보내기만** (실종·발견·커뮤니티 알림): 토큰 + CHAT_ID 만으로 Flask 재시작 후 동작. 확인: `GET /api/telegram/status`.
- **받기** (`/subscribe` 등): 로컬은 `poll_telegram_bot.py` 병행 실행, 배포 시 공인 HTTPS + `TELEGRAM_WEBHOOK_SECRET` + `setWebhook` 으로 `https://도메인/api/telegram/webhook/<SECRET>` 등록.

## 텔레그램 지역 라우팅·구독 (2026-03-28)
- `telegram_regions.json`: 주소 키워드 → 지역 그룹 `chat_id` 매핑. `telegram_routing.resolve_all_target_chat_ids`
- `telegram_subscribers` 테이블 + 봇 명령 `/subscribe`, `/unsubscribe`, `/list` (`telegram_bot.py`, `poll_telegram_bot.py` 또는 `POST /api/telegram/webhook/<secret>`)
- 실종/발견 알림: `notify_telegram_routed(본문, address)` — 지역 채널 + 구독자 DM + (옵션) 기본 채널 폴백
- 환경 변수: `TELEGRAM_REGION_FALLBACK_DEFAULT`, `TELEGRAM_ALWAYS_SEND_DEFAULT`, `TELEGRAM_WEBHOOK_SECRET`

## Flask 정적 HTML 경로 수정 (2026-03-28)
- `lost-pets.html` 등이 `backend/` 루트가 아니라 `backend/static/` 에만 있어 404가 났음. `send_from_directory(..., 'static')` 로 수정. `/index.html` 별도 라우트 추가(서브페이지에서 홈 링크용).

## 실종 등록 모달 UX — 길이 단축 (2026-03-28)
- 모달 최대 너비 확대(`modal-content--lost-form`), **본문만 스크롤** + **등록/수정 버튼 하단 고정**(`modal-form__body` / `modal-form__footer`).
- **나이·실종 시간·기타 특이사항**은 `<details>`로 접어 두어 첫 화면 세로 길이 감소. 안내 문구(`modal-form__hint`) 추가.
- 작성/수정 모달 동일 패턴 적용 (`lost-pets.html` + `style.css`).

## 실종 게시판「실종 동물 등록」클릭 무반응 (2026-03-28)
- **원인**: `/js/`, `/css/` 라우트가 `backend/js`, `backend/css`(빈 폴더)를 가리켜 `lost-pets.js`가 404 → 스크립트가 안 돌아 등록 버튼에 리스너가 붙지 않음.
- **해결**: `app.py`에서 `/js/<path>`, `/css/<path>`를 `backend/static/js`, `backend/static/css`로 서빙하도록 수정.
- **추가**: `lost-pets.js`에서 등록 모달은 `display: flex`로 통일, 상세·수정 모달 열 때도 `flex`. `writeForm`·`editForm`에 `submit` 리스너는 요소가 있을 때만 등록(부분 로드/ID 불일치 시 전체 스크립트 중단 방지).

## 메인 화면 UI (2026-03-28)
- `backend/static/index.html`: 첫 화면을 **최신 게시물**(실종+발견 API 합침) → **커뮤니티 최신 글** → **감동적인 성공 사례** → 팁 순으로 배치.
- 헤더에 **실종동물 등록** / **발견 동물 알리기** 버튼: 클릭 시 `registerModal`로 게시물 등록 폼 표시 (`modal-content--register`, 스크롤 가능).
- `script.js`: `loadLatestPostsFeed()`, `openRegisterModal` / `closeRegisterModal`, 등록 성공 시 모달 닫고 피드·커뮤니티 갱신. 이미지는 기존과 같이 `/api/upload` 후 JSON 등록.

## Windows 서버 실행 배치 (2026-03-28)
- 프로젝트 루트에 `서버실행.bat` 추가: 더블클릭 시 `backend`로 이동 → `pip install -r requirements.txt` → `py -3 app.py`(없으면 `python`) 순으로 Flask 서버 기동.
- **`backend` 안에서** `서버실행`을 치면 루트 배치가 없어서 오류가 난다. `backend\서버실행.bat`(내용은 `run.bat` 호출)과 **`backend\run.bat`**(실제 로직, 영문 파일명) 추가. `backend` 폴더에서 `run` 또는 `서버실행` 입력 가능.
- **CMD 인코딩 이슈**: 배치 파일 안에 UTF-8 한글이 있으면 기본 CMD(cp949)에서 줄이 깨져 `'은 내부 또는 외부 명령...'` 오류가 난다. 배치 본문은 **ASCII만** 사용하도록 수정함 (`chcp 65001` 제거, `goto` 분기로 단순화).
- **파이프 문자**: `echo ... | Stop: ...` 형태는 CMD에서 `|`를 파이프로 해석해 `Stop:`이 명령으로 실행된다. `echo`를 두 줄로 나눔.

## 브랜드명 변경 (2026-03-28)
- 서비스 표기명을 **찾아Dream / 찾아Dream2**에서 **반려동물 차자드림**으로 통일했습니다.
- 적용 위치: `backend/static/*.html`, 루트 동일 HTML 복사본, `README.md`, `backend/README.md`, 푸터 연도 2026 반영(메인 `index.html`).

## 텔레그램 알림 연동 (2026-03-28)
- `telegram_notify.py`: 봇 API로 HTML 요약 메시지 전송, `TELEGRAM_BOT_TOKEN`·`TELEGRAM_CHAT_ID` 없으면 동작 안 함.
- `GET /api/telegram/status`: 설정 여부만 JSON으로 확인 (비밀 값 미노출).
- `requirements.txt`에 `python-dotenv`, `backend/.env.example`·`backend/.gitignore`(.env) 추가.

### 텔레그램 알림 범위
- 커뮤니티 `POST /api/community`: `detect_chajunda_imbo_labels()`로 **실종·발견** 키워드 또는 **찾는다·임보** 성격일 때 알림.
- 실종/발견 `POST /api/lost-pets`, `POST /api/found-pets`: 등록 시마다 알림 (`format_lost_pet_notification` / `format_found_pet_notification`).
- 메인 `index.html` 폼: 존재하지 않는 `#photoUrl` 참조로 등록 실패하던 문제를 수정 — `#photo` 업로드 + 작성자/비밀번호 필드 추가 후 API 연동.

## 1. 프로젝트 초기 구조 및 주요 파일
- **index.html**: 메인 페이지 (실종/발견 동물 등록, 최신 게시물, 커뮤니티 미리보기 등)
- **community.html**: 커뮤니티 게시판 페이지
- **js/script.js**: 메인 페이지용 JS
- **js/community.js**: 커뮤니티 게시판용 JS
- **backend/app.py**: Python(Flask) 기반 백엔드 서버
- **community.db**: SQLite 데이터베이스 (커뮤니티 글 저장)
- **css/style.css**: 공통 스타일

---

## 2. 커뮤니티 게시판 기능
- 글 작성, 조회, 수정, 삭제 기능 구현
- 글 작성 시 제목, 내용, 작성자, 비밀번호 입력
- 글 수정/삭제 시 비밀번호 확인 후 처리
- 글 목록에서 각 글에 대해 수정/삭제 버튼 제공
- 글 작성/수정/삭제 시 프론트-백엔드 연동 (REST API)

---

## 3. 보안 및 데이터 보호
- 커뮤니티 글 비밀번호 컬럼 추가 (DB 마이그레이션)
- 비밀번호가 일치해야만 글 수정/삭제 가능하도록 API 및 JS 수정

---

## 4. 커뮤니티 사진 업로드 기능
- 커뮤니티 글 작성/수정 시 이미지 파일 업로드 가능
- 업로드된 이미지는 서버 uploads 폴더에 저장, URL로 접근 가능
- 글 카드에 이미지 미리보기 표시
- 백엔드: `/api/upload` 엔드포인트 및 `/uploads/` 정적 파일 서비스 추가
- DB에 photoUrl 컬럼 추가 (DB 마이그레이션)

---

## 5. 메인(index.html)에서 커뮤니티 최신 글 미리보기
- index.html에 커뮤니티 최신 글 4개 미리보기 영역 추가
- js/script.js에서 API로 커뮤니티 글 불러와서 미리보기 렌더링

---

## 6. 기타 주요 개선 및 문제 해결
- Flask에서 정적 파일(css, js, 이미지 등) 및 HTML 서비스 라우터 추가
- community.html의 "← 찾아Dream2" 링크를 `/`로 수정하여 Not Found 문제 해결
- CORS 문제, 서버 실행/폴더 경로 문제, DB 마이그레이션 등 실시간 해결

---

## 7. 앞으로 추가할 수 있는 기능 (예시)
- 커뮤니티 글 태그/검색 기능
- 게시글 신고/관리자 기능
- 메인 게시판(실종/발견)에도 사진 업로드 기능
- 커뮤니티 글에 댓글 기능 등

---

## 8. 구글 클라우드 호스팅 관련 참고 및 결정사항 (2025-06-14)

### 1) 구글 클라우드 호스팅 방법 요약
- **정적 웹사이트(HTML, CSS, JS만)**: Google Cloud Storage 사용
  - 버킷 생성 → 정적 웹사이트 호스팅 설정 → 파일 업로드 → 퍼블릭 권한 부여 → 버킷 URL로 접속
- **동적 웹앱(Flask, Node.js 등 서버 필요)**: Google App Engine 사용
  - App Engine 활성화 → app.yaml/requirements.txt 등 준비 → gcloud app deploy로 배포 → 배포 URL로 접속

### 2) Google Cloud Storage vs App Engine 차이점
| 항목                | Cloud Storage (정적) | App Engine (동적)      |
|---------------------|---------------------|------------------------|
| 서버 코드 실행      | 불가                | 가능                   |
| DB 연동             | 불가                | 가능                   |
| 가격                | 매우 저렴           | 트래픽/사용량에 따라   |
| 관리 편의성         | 매우 쉬움           | 쉬움(서버리스)         |
| 확장성              | 자동                | 자동                   |
| 사용 예시           | 랜딩, 포트폴리오    | API, 웹서비스, 백엔드  |

- 정적 사이트면 Cloud Storage, 동적 기능(로그인, DB, API 등)이 필요하면 App Engine 사용.

---

**최종 적용일:** 2025-06-14

## 9. 프론트엔드/백엔드 분리 배포 구조 및 적용 결정 (2025-06-15)

### 1) 분리 배포 구조 개념
- **프론트엔드(정적 파일)**: index.html, community.html, js, css 등은 Cloud Storage(정적 호스팅) 또는 Netlify/Vercel 등에서 서비스
- **백엔드(API 서버)**: Flask(GCP App Engine)는 오직 API(`/api/...`)만 서비스
- 프론트엔드 JS에서 API 요청을 GCP 백엔드 URL로 보냄 (예: fetch('https://...appspot.com/api/community'))

### 2) 실전 적용 방법
- 정적 파일은 backend 폴더에 둘 필요 없이, 최상단(또는 frontend 폴더)에 두고 정적 호스팅에 업로드
- backend 폴더에는 Flask 서버 코드와 API 관련 파일만 남김
- 프론트엔드와 백엔드의 배포/운영이 완전히 분리됨

### 3) 장점
- 프론트/백 분리로 유지보수, 확장성, 배포 속도 향상
- 정적 파일은 빠르고 저렴하게 서비스, API는 서버리스로 확장

---

**최종 적용일:** 2025-06-15

이 파일은 반려동물 차자드림 프로젝트의 모든 주요 변경 및 작업 내역을 기록한 문서입니다. 
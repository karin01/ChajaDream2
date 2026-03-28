# ChajaDream2 — Firebase(Firestore) DB 연동 기록

## Git 원격

- 저장소: **https://github.com/karin01/ChajaDream2** (`main` 브랜치)
- `ChajaDream2` 폴더만 **독립 저장소**로 초기화함 (옵시디언 vault 루트 Git과 별개).

## 현재 상태 (2026-03-29)

- Firebase 콘솔 프로젝트: **chadream2**  
  - 개요: <https://console.firebase.google.com/project/chadream2/overview?hl=ko>
- 저장소 코드:
  - `js/firebase-init.js` · `backend/static/index.html` — **chadream2** 웹앱 `firebaseConfig` 로 반영됨 (2026-03-29)
  - `backend/app.py` 는 **SQLite** (`community.db`) 로 커뮤니티·실종·발견·성공사례 저장

## 왜 Firestore인가

- Firebase에서 말하는 “DB”는 보통 **Cloud Firestore**(문서 DB) 또는 **Realtime Database**이다.
- 신규 프로젝트는 **Firestore** 권장(쿼리·구조·확장이 유리).

## 콘솔에서 할 일

1. [Firestore 데이터베이스] → **데이터베이스 만들기** → 리전 선택(가까운 곳, 이후 변경 어려움).
2. 보안 규칙은 개발 중 `test` 모드가 아니라, **프로덕션 규칙 초안**부터 설계(아래 참고).
3. [프로젝트 설정] → [내 앱] → **웹 앱 추가** → 생성 후 **firebaseConfig** 객체 복사.
4. `js/firebase-init.js` 의 `firebaseConfig` 를 **chadream2** 웹앱 값으로 전부 교체.

## 아키텍처 선택 (중요)

| 방식 | 장점 | 주의 |
|------|------|------|
| **브라우저만 Firestore SDK** | 서버 부담 적음, 실시간 UI에 적합 | **보안 규칙**으로 읽기/쓰기를 엄격히 제한해야 함(API 키는 공개됨) |
| **Flask + Admin SDK** | 기존 SQLite API와 동일하게 서버가 검증·통합 가능 | 서비스 계정 JSON은 **절대 Git·공개 저장소에 넣지 말 것** |

텔레그램 알림·운영자 전용 작업은 **Admin SDK(서버)** 쪽이 안전하다.

## 보안 규칙 초안 방향

- “누구나 쓰기” 규칙은 피하고, **인증(Firebase Auth)** 또는 **커스텀 토큰** 연동 후 `request.auth` 기반 규칙을 목표로 한다.
- 비밀번호만으로 글 수정/삭제하는 현재 모델을 Firestore에 그대로 옮기려면, **해시·검증 로직을 서버(Functions 또는 Flask)** 쪽에 두는 편이 안전하다.

## 체크리스트

- [ ] 콘솔에서 Firestore 생성 완료
- [x] chadream2 웹앱 `firebaseConfig` 로 `js/firebase-init.js` · `backend/static/index.html` 교체
- [ ] (선택) `backend`에 `firebase-admin` + 서비스 계정(.env 경로만, 파일은 Git 제외)
- [ ] SQLite → Firestore 마이그레이션 범위 결정(커뮤니티만 / 전체)

## 비밀 정보

- `.env` 의 API 키·봇 토큰·서비스 계정은 **채팅·스크린샷에 노출 금지**. 노출 시 **즉시 재발급**한다.

## 트러블슈팅 (CLI·Git·폴더)

### 1) `firebase.json` 없음 / `Not in a Firebase app directory`

- **원인:** `firebase init`을 끝내지 않았거나, **다른 폴더**에서 명령을 실행함 (예: `Downloads\ChajaDream2` 는 비어 있거나 복사본만 있을 수 있음).
- **조치:** 실제 소스가 있는 폴더 (`…\Jungwon_Drive_Obsidian_Vault\ChajaDream2`)로 `cd` 한 뒤 CLI 실행.
- 이 저장소 루트에 **최소 Firebase 파일 추가됨** (2026-03-29): `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`.
- **npm/경로 이슈로 `C:\Users\Luna\Downloads\ChajaDream2`에 복사본을 쓰는 경우**, 동일한 네 파일을 그 폴더에도 두어야 `firebase use` / `deploy`가 동작함 (2026-03-29 동기화).

### 2) `firebase init` 때 GitHub workflow / `karin01/ChajaDream2` 무효 / 서비스 계정 404

- **원인:** Hosting 옵션 중 **GitHub에 자동 배포(Actions) 연동**을 켜면, 저장소 접근·GCP 서비스 계정 생성 등이 한 번에 필요함. OAuth·권한·이름 불일치 시 **유효하지 않은 저장소** 또는 **IAM 404** 가 난다.
- **조치:** 당장은 **GitHub Actions 자동 배포 없이** 쓰려면, init 되돌리기 어렵다면 **로컬에서만** `firebase deploy` 하면 됨. 다음 init부터는 **“GitHub로 배포 설정” 질문에 No** 가 가장 단순함.

### 3) `git push` — `Permission denied (publickey)`

- **원인:** 원격이 `git@github.com:...` **SSH** 인데, PC에 SSH 키가 없거나 GitHub 계정에 **공개 키가 등록되지 않음**.
- **조치 (택1):**
  - **HTTPS로 원격 변경:** `git remote set-url origin https://github.com/karin01/ChajaDream2.git` 후 `git push` (비밀번호 대신 **Personal Access Token** 사용).
  - 또는 GitHub 문서대로 **SSH 키 생성 → 계정에 공개 키 등록** 후 다시 `git push`.

### 4) 배포 명령 (프로젝트 루트에서)

```bash
cd "실제\ChajaDream2\경로"
npx -y firebase-tools@latest use
npx -y firebase-tools@latest deploy --only firestore
```

Hosting까지 쓰려면 `firebase.json`에 `hosting` 블록과 `public` 폴더 구성이 추가로 필요함 (정적 파일 경로 설계 후).

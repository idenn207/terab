# Push 2FA 설계 문서 (DEV-012 ~ DEV-016)

**날짜:** 2026-04-19
**범위:** DEV-012 (Push 2FA 백엔드), DEV-013 (PC 프론트), DEV-014 (모바일 승인 모달), DEV-015 (신뢰기기), DEV-016 (백업 코드)
**와이어프레임 참조:** Claude Design — Drive Wireframes.html (Screen2FAPC, ScreenSecurityPC)

---

## 목표

로그인 자격증명 검증 후 등록된 모바일 디바이스에 Push 알림을 전송하여 숫자 선택으로 2차 인증을 수행한다. 로그인 복구 수단(백업 코드)과 반복 인증 면제(신뢰기기)까지 함께 구현하여 실서비스 수준의 인증 시스템을 완성한다.

---

## 전체 플로우

```
PC: POST /api/auth/login (자격증명)
    │
    ├─ 등록 디바이스 없음 → 토큰 즉시 반환 (2FA 없음)
    ├─ 신뢰기기 쿠키 유효 → 토큰 즉시 반환 (2FA 스킵)
    └─ 등록 디바이스 있음 → 챌린지 생성
           │
           ├─ 응답: { status:"2FA_REQUIRED", challengeId, options:["47","82","13"], expiresAt }
           │
           ├─ PC: /login/2fa?id=xxx 이동
           │    └─ 3개 숫자 표시 + 60초 타이머 + 3초 폴링
           │
           └─ Notification MS → FCM Push 발송
                    data: { type:"2FA_CHALLENGE", challengeId, options:["47","82","13"] }
                         │
                    Mobile: 딥링크 /auth/2fa/{challengeId}
                    └─ 3개 숫자 중 정답 선택
                       POST /api/auth/2fa/challenge/{id}/respond
                                │
                    PC 폴링 → APPROVED → 토큰 수신 → /drive
```

### 플로우 설계 근거

- **challengeId 인증**: UUID 122비트 엔트로미. 폴링 엔드포인트에 별도 토큰 불필요. 개인 NAS 환경에서 적합.
- **정답 비공개**: FCM payload에 `correctNumber` 미포함. 모바일은 선택만 전송, 서버가 검증.
- **respond 응답 204**: 맞음/틀림 즉시 노출 시 브루트포스 가능. PC 폴링에서만 결과 확인.
- **폴링 3초**: NAS 소수 사용자 환경에서 동시 2FA 세션은 1~2개. 인덱싱된 단일 컬럼 조회로 부하 무시.

---

## DB 스키마

### V4__two_fa.sql (신규)

```sql
-- 2FA 챌린지
CREATE TABLE IF NOT EXISTS two_fa_challenges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  options      VARCHAR(20) NOT NULL,   -- "47,82,13" 콤마 구분
  correct_num  CHAR(2)     NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'PENDING', -- PENDING/APPROVED/DENIED/EXPIRED
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_two_fa_challenges_user_id ON two_fa_challenges(user_id);
CREATE INDEX idx_two_fa_challenges_status  ON two_fa_challenges(status);

-- 백업 코드
CREATE TABLE IF NOT EXISTS backup_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  VARCHAR(60) NOT NULL,   -- bcrypt
  used_at    TIMESTAMPTZ,            -- NULL = 미사용
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_codes_user_id ON backup_codes(user_id);

-- 신뢰된 기기 (30일 2FA 스킵)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64)  NOT NULL,   -- SHA-256 hex
  user_agent  VARCHAR(500),
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_trusted_devices_user_id    ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_token_hash ON trusted_devices(token_hash);
```

### 설계 결정

| 결정 | 이유 |
|------|------|
| `options` VARCHAR(20) | "47,82,13" 형태, split(",")으로 파싱. JSON은 오버킬 |
| `trusted_devices.token_hash` SHA-256 | 만료 체크가 목적. bcrypt 불필요, 속도 우선 |
| `backup_codes.used_at` nullable | NULL=미사용. 별도 boolean 없이 단일 필드로 처리 |

---

## API 설계 (DEV-012)

### 기존 로그인 응답 분기

`POST /api/auth/login` — 기존 `LoginUseCase` 수정

```
기존: { accessToken, user }

신규 분기:
  디바이스 없음     → { accessToken, user }             (변경 없음)
  신뢰기기 쿠키 유효 → { accessToken, user }             (2FA 스킵)
  디바이스 있음     → { status:"2FA_REQUIRED",
                       challengeId, options:["47","82","13"], expiresAt }
```

### 신규 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/auth/2fa/challenge/{id}/status` | 없음 (UUID가 비밀) | PC 폴링 |
| `POST` | `/api/auth/2fa/challenge/{id}/respond` | Bearer AT | 모바일 승인/거부 |
| `POST` | `/api/auth/login/backup` | 없음 | 백업 코드 로그인 |
| `POST` | `/api/auth/backup-codes/regenerate` | Bearer AT | 8개 재발급 |
| `GET` | `/api/auth/backup-codes/count` | Bearer AT | 잔여 코드 수 |
| `POST` | `/api/auth/trusted-devices` | Bearer AT | 신뢰기기 등록 |
| `GET` | `/api/auth/trusted-devices` | Bearer AT | 목록 조회 |
| `DELETE` | `/api/auth/trusted-devices/{id}` | Bearer AT | 신뢰기기 해제 |

### 주요 응답 형태

```java
// GET /api/auth/2fa/challenge/{id}/status

// PENDING
{ "status": "PENDING", "options": ["47","82","13"], "remainingSeconds": 43 }

// APPROVED
{ "status": "APPROVED", "accessToken": "...", "user": { "id", "username", "nickname" } }

// DENIED | EXPIRED
{ "status": "DENIED" }
```

```java
// POST /api/auth/2fa/challenge/{id}/respond
// Request
{ "selectedNumber": "47" }
// Response: 204 No Content (맞음/틀림 미노출)
```

```java
// POST /api/auth/login/backup
// Request
{ "username": "...", "password": "...", "backupCode": "A3K9-MZ7P" }
// Response (성공)
{ "accessToken": "...", "user": { ... } }
```

```java
// POST /api/auth/backup-codes/regenerate
// Response: { "codes": ["A3K9-MZ7P", "B2X4-NK1Q", ...] }  ← 이 한 번만 평문 노출
```

### 패키지 구조 (api 서비스)

```
com.terab.api/
  auth/
    application/
      LoginUseCase.java                   (수정 — 2FA 분기, 신뢰기기 검증)
      LoginWithBackupCodeUseCase.java     (신규)
      interfaces/
        ILoginWithBackupCodeUseCase.java  (신규)
    controller/
      AuthController.java                 (수정 — /login/backup 엔드포인트 추가)
    dto/
      LoginResponse.java                  (수정 — 2FA_REQUIRED 분기 포함)

  two-fa/                                 (신규 도메인)
    domain/TwoFaChallenge.java
    application/
      CreateChallengeUseCase.java
      GetChallengeStatusUseCase.java
      RespondToChallengeUseCase.java
      interfaces/
        ICreateChallengeUseCase.java
        IGetChallengeStatusUseCase.java
        IRespondToChallengeUseCase.java
    controller/TwoFaController.java
    dto/
      ChallengeStatusResponse.java
      RespondRequest.java
    service/TwoFaChallengeService.java
    repository/TwoFaChallengeRepository.java

  backup-code/                            (신규 도메인)
    domain/BackupCode.java
    application/
      RegenerateBackupCodesUseCase.java
      GetBackupCodeCountUseCase.java
      interfaces/ ...
    controller/BackupCodeController.java
    dto/
      BackupCodeCountResponse.java
      BackupCodesResponse.java
    service/BackupCodeService.java
    repository/BackupCodeRepository.java

  trusted-device/                         (신규 도메인)
    domain/TrustedDevice.java
    application/
      RegisterTrustedDeviceUseCase.java
      GetTrustedDevicesUseCase.java
      RevokeTrustedDeviceUseCase.java
      interfaces/ ...
    controller/TrustedDeviceController.java
    dto/
      TrustedDeviceResponse.java
    service/TrustedDeviceService.java
    repository/TrustedDeviceRepository.java
```

---

## Notification MS 수정 사항

### PushChallengeEvent 필드 추가

기존 `code` 필드(단일 코드)를 `options`(3개 선택지)로 교체한다.

```java
// 기존
public record PushChallengeEvent(
  UUID userId, String pushToken, String code, UUID challengeId, OffsetDateTime expiresAt
) {}

// 변경 후
public record PushChallengeEvent(
  UUID userId, String pushToken, String options, UUID challengeId, OffsetDateTime expiresAt
  // options: "47,82,13" 형태 — FCM data payload에 그대로 포함
) {}
```

`FcmPushService`의 FCM data payload:

```
type         = "2FA_CHALLENGE"
challengeId  = "{uuid}"
options      = "47,82,13"
```

---

## 프론트엔드 설계 (DEV-013 + DEV-014)

### FSD 구조

```
features/
  login-by-2fa/                            (기존 빈 scaffold → 구현)
    api/twoFactorApi.ts                    — 폴링, respond API 호출
    model/
      useTwoFactorPolling.ts               — 3초 폴링 + 60초 카운트다운
                                             (기존 useTwoFactorSocket.ts 대체)
      useTwoFactorRespond.ts               — 모바일 숫자 선택 훅
    ui/
      TwoFactorWaiting.tsx                 — PC D-01a: 3개 숫자 + 타이머 (기존 파일 구현)
      TwoFactorBackupEntry.tsx             — PC D-01b: 백업 코드 입력
      TwoFactorApprovalPage.tsx            — Mobile D-01c: 딥링크 진입 숫자 선택
    index.ts

  backup-code/                             (신규)
    api/backupCodeApi.ts
    model/useBackupCode.ts
    ui/BackupCodeSection.tsx               — D-10a 보안 설정 내 섹션
    index.ts

  trusted-device/                          (신규)
    api/trustedDeviceApi.ts
    model/useTrustedDevice.ts
    ui/
      TrustedDeviceSection.tsx             — D-10a 보안 설정 내 섹션
      TrustThisDeviceCheckbox.tsx          — 2FA 성공 후 체크박스
    index.ts
```

### 라우팅 추가 (router/config.tsx)

```typescript
{ path: '/login/2fa',     element: <TwoFAWaitPage /> }     // D-01a
{ path: '/login/backup',  element: <TwoFABackupPage /> }   // D-01b
{ path: '/auth/2fa/:id',  element: <TwoFAApprovalPage /> } // D-01c (모바일 딥링크)
```

### D-01a — PC 2FA 대기 화면 (TwoFactorWaiting.tsx)

와이어프레임 `Screen2FAPC` 기준:

- 400px 카드 중앙
- 3개 숫자 박스 80×80px
- `useTwoFactorPolling` — 3초 간격 상태 조회
  - `APPROVED`: TrustThisDeviceCheckbox 표시 → "계속" 버튼 클릭 시점에 AT를 Zustand store에 저장 → `/drive`
  - `DENIED` / `EXPIRED`: 에러 메시지 + `/login` 이동
- 타이머: `remainingSeconds` 카운트다운, 0 시 만료 처리
- "다시 보내기": 새 챌린지 생성 → 화면 갱신
- "백업 코드 사용": `/login/backup` 이동

### D-01c — 모바일 승인 화면 (TwoFactorApprovalPage.tsx)

딥링크 `/auth/2fa/{challengeId}` 진입:

- GET status에서 options 조회 → 3개 숫자 박스 표시
- 탭 → `POST /api/auth/2fa/challenge/{id}/respond`
- 결과 무관하게 "선택 완료" 안내만 표시 (보안)
- 만료 챌린지 → "만료된 요청입니다" 안내

### 신뢰기기 체크박스 위치

2FA 성공(APPROVED) 수신 시점, `/drive` 이동 직전:

```tsx
// TwoFactorWaiting.tsx — APPROVED 상태 표시
<TrustThisDeviceCheckbox />   // "이 기기를 30일간 신뢰"
<button onClick={handleComplete}>계속</button>
// 체크 시: POST /api/auth/trusted-devices → /drive
// 미체크: 바로 /drive
```

---

## 신뢰기기 설계 (DEV-015)

### 쿠키 설계

| 속성 | 값 |
|------|-----|
| 이름 | `trustToken` |
| 저장 방식 | SHA-256 해시만 DB 저장, 평문은 쿠키에만 |
| `HttpOnly` | ✓ |
| `Secure` | ✓ |
| `Path` | `/api/auth` |
| `SameSite` | `Strict` |
| `Max-Age` | 2592000초 (30일) |

### 로그인 시 검증 순서 (LoginUseCase)

```
1. 자격증명 검증
2. 디바이스 등록 여부 확인
   └─ 없음 → 토큰 반환 (2FA 없음)
3. trustToken 쿠키 존재 확인
   └─ 있음 → SHA-256 → DB 조회 → expires_at 확인
      └─ 유효 → 토큰 반환 (2FA 스킵)
4. 챌린지 생성 → 2FA_REQUIRED 반환
```

---

## 백업 코드 설계 (DEV-016)

### 코드 형식

`XXXX-XXXX` — 영숫자 대문자 8자, 하이픈 구분  
예: `A3K9-MZ7P`

### 생성 규칙

- 재발급 시 기존 코드 전체 삭제 후 8개 신규 생성 (Invalidate All → Regenerate)
- bcrypt 해싱 후 DB 저장
- 평문은 재발급 응답 1회에만 노출

### 사용 플로우

```
POST /api/auth/login/backup
  { username, password, backupCode: "A3K9-MZ7P" }
  1. 자격증명 검증
  2. 미사용 코드 목록에서 bcrypt 순차 비교
  3. 매칭 → used_at 설정 → 토큰 반환
  4. 불일치 → 401 INVALID_CREDENTIALS
```

### D-10a 보안 설정 — 백업 코드 섹션

- `GET /api/auth/backup-codes/count` → "남은 코드: 6 / 8"
- "백업 코드 재발급" 버튼 → 확인 모달 → 8개 코드 1회 표시 (복사/다운로드)

---

## 보안 설정 페이지 (D-10a) 전체 구성

와이어프레임 `ScreenSecurityPC` 기준으로 3개 섹션이 한 페이지에 조합된다.

```
⚙ 설정 > 보안 탭
├── 등록된 디바이스      ← Device 도메인 (DEV-010에서 구축됨)
├── 백업 코드            ← backup-code feature (DEV-016)
└── 신뢰된 기기          ← trusted-device feature (DEV-015)
```

---

## 파일 맵

### API 서비스 신규/수정

```
services/api/src/main/resources/db/migration/
  V4__two_fa.sql                                   (신규)

services/api/src/main/java/com/terab/api/
  auth/
    application/LoginUseCase.java                  (수정)
    application/LoginWithBackupCodeUseCase.java    (신규)
    application/interfaces/ILoginWithBackupCodeUseCase.java (신규)
    controller/AuthController.java                 (수정)
    dto/LoginResponse.java                         (수정)
  two-fa/                                          (신규 도메인 전체)
  backup-code/                                     (신규 도메인 전체)
  trusted-device/                                  (신규 도메인 전체)
  notification/event/PushChallengeEvent.java       (수정 — options 필드)
  common/exception/ErrorCode.java                  (수정 — 신규 에러코드 추가)
  security/SecurityConfig.java                     (수정 — 신규 엔드포인트 인가 규칙)
```

### Notification MS 수정

```
services/notification/src/main/java/com/terab/notification/
  push/dto/PushChallengeEvent.java                 (수정 — options 필드)
  push/service/FcmPushService.java                 (수정 — FCM payload 구성)
```

### Web 프론트 신규/수정

```
services/web/src/
  features/login-by-2fa/                           (기존 scaffold 구현)
    api/twoFactorApi.ts
    model/useTwoFactorPolling.ts
    model/useTwoFactorRespond.ts
    ui/TwoFactorWaiting.tsx
    ui/TwoFactorBackupEntry.tsx
    ui/TwoFactorApprovalPage.tsx
    index.ts

  features/backup-code/                            (신규)
    api/backupCodeApi.ts
    model/useBackupCode.ts
    ui/BackupCodeSection.tsx
    index.ts

  features/trusted-device/                         (신규)
    api/trustedDeviceApi.ts
    model/useTrustedDevice.ts
    ui/TrustedDeviceSection.tsx
    ui/TrustThisDeviceCheckbox.tsx
    index.ts

  features/index.ts                                (수정 — 신규 feature re-export)
  app/providers/router/config.tsx                  (수정 — 3개 라우트 추가)
  pages/                                           (신규 페이지 컴포넌트 — 라우트 단위)
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-19 | 초기 설계 문서 작성 (DEV-012~016) |

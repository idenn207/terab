# 인증 시스템 설계 — teraB

**날짜:** 2026-03-31  
**범위:** v0.1.0 인증 기능 전체 (AUTH-01~02, AUTH-05~09, AUTH-11)  
**구현 방식:** 인크리멘털 (Phase 1 → 5 순서)

---

## 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 로그인 UI 스타일 | 다크 중앙 카드형 |
| 2FA 대기 화면 | 안내 중심형 + 백업코드/재전송 버튼 |
| Refresh Token 저장 | Web = HttpOnly Cookie, Mobile = Secure Storage |
| 구현 방식 | 인크리멘털 (Phase 1부터 동작하는 상태로) |

---

## 인크리멘털 구현 순서

| Phase | 내용 | 결과물 |
|-------|------|--------|
| **1** | DB 스키마 + RBAC + ID/PW 로그인 + JWT | 실제 로그인 동작 |
| **2** | 초대 기반 가입 | 신규 유저 온보딩 |
| **3** | Push 2FA + WebSocket | 숫자 매칭 인증 |
| **4** | 신뢰기기 + 백업코드 | 2FA 보조 수단 |
| **5** | 디바이스 관리 | 연결 기기 목록/해제 |

---

## 섹션 1 — DB 스키마

```sql
-- 사용자
users (
  id          UUID PK DEFAULT gen_random_uuid(),
  username    VARCHAR(50) UNIQUE NOT NULL,
  nickname    VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE,          -- optional
  password    VARCHAR(255) NOT NULL,        -- bcrypt
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
)

-- RBAC
roles        (id UUID DEFAULT gen_random_uuid(), name VARCHAR, is_system BOOLEAN)
permissions  (id UUID DEFAULT gen_random_uuid(), resource VARCHAR, action VARCHAR)
role_permissions (role_id UUID FK, permission_id UUID FK)
user_roles   (user_id UUID FK, role_id UUID FK)

-- 인증
refresh_tokens (
  id           UUID PK DEFAULT gen_random_uuid(),
  user_id      UUID FK,
  token_hash   VARCHAR,       -- bcrypt 해시 저장 (원문 아님)
  device_id    UUID FK NULL,  -- Phase 5(devices) 구현 전까지 NULL 허용
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
)

-- Phase 3
twofa_challenges (
  id           UUID PK DEFAULT gen_random_uuid(),
  user_id      UUID FK,
  code         CHAR(2),       -- 2자리 숫자 챌린지
  expires_at   TIMESTAMPTZ,   -- 5분
  used_at      TIMESTAMPTZ
)

-- Phase 4
trusted_devices (
  id            UUID PK DEFAULT gen_random_uuid(),
  user_id       UUID FK,
  device_id     UUID FK,
  trusted_until TIMESTAMPTZ   -- 30일
)

backup_codes (
  id           UUID PK DEFAULT gen_random_uuid(),
  user_id      UUID FK,
  code_hash    VARCHAR,       -- bcrypt 해시
  used_at      TIMESTAMPTZ
)

-- Phase 5
devices (
  id           UUID PK DEFAULT gen_random_uuid(),
  user_id      UUID FK,
  name         VARCHAR,       -- "Chrome on MacBook"
  push_token   VARCHAR,       -- FCM/APNs 토큰
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
)

-- Phase 2
invitations (
  id           UUID PK DEFAULT gen_random_uuid(),
  email        VARCHAR,
  token        VARCHAR UNIQUE,
  role_id      UUID FK,
  invited_by   UUID FK,
  expires_at   TIMESTAMPTZ,   -- 48시간
  accepted_at  TIMESTAMPTZ
)
```

### JWT 구조

```
Access Token  — 만료 15분, Bearer Header
Refresh Token — 만료 7일, HttpOnly Cookie (Web) / Secure Storage (Mobile)
```

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "username": "skypark207",
  "roles": ["USER"],
  "permissions": ["file:read", "file:write", "file:delete", "share:create", "storage:read"],
  "device_id": "device-uuid",   // Phase 5 이전까지 null
  "iat": 1700000000,
  "exp": 1700000900
}
```

---

## 섹션 2 — API 엔드포인트

### Phase 1 — ID/PW 로그인 + JWT

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/auth/login` | 로그인 → Access Token + Refresh Token 발급 | 불필요 |
| `POST` | `/api/auth/logout` | Refresh Token 폐기 | Access Token |
| `POST` | `/api/auth/refresh` | Access Token 갱신 | Refresh Token (Cookie) |
| `GET`  | `/api/auth/me` | 현재 유저 정보 조회 | Access Token |

**POST `/api/auth/login` 응답:**
```
200: { accessToken, user: { id, username, nickname } }
     Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict

202: { challengeId, code: "47" }    ← 2FA 필요 시 (Phase 3~)

401: { code: "INVALID_CREDENTIALS" }
423: { code: "ACCOUNT_DISABLED" }
```

### Phase 2 — 초대 기반 가입

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET`  | `/api/auth/invitations/{token}` | 초대 토큰 유효성 확인 | 불필요 |
| `POST` | `/api/auth/register` | 초대 토큰으로 가입 | 불필요 |

```
POST /api/auth/register
Request:  { invitationToken, username, nickname, password }
Response: { accessToken, user: { id, username, nickname } }
```

### Phase 3 — Push 2FA

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/auth/2fa/resend` | 2FA Push 재전송 | challengeId |
| `POST` | `/api/auth/2fa/approve` | 모바일 앱 → 승인/거부 | Access Token (앱) |
| `WS`   | `/ws/auth/2fa/{challengeId}` | PC가 승인 결과 대기 | 불필요 |

**WebSocket 메시지:**
```json
{ "type": "APPROVED", "accessToken": "...", "user": { ... } }
{ "type": "DENIED" }
{ "type": "EXPIRED" }
```

### Phase 4 — 신뢰기기 + 백업코드

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/auth/trust-device` | 현재 기기 30일 신뢰 등록 | Access Token |
| `POST` | `/api/auth/2fa/backup` | 백업코드로 2FA 대체 | challengeId |
| `GET`  | `/api/auth/backup-codes` | 백업코드 목록 조회 (마스킹) | Access Token |
| `POST` | `/api/auth/backup-codes/regenerate` | 백업코드 재발급 | Access Token |

### Phase 5 — 디바이스 관리

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET`  | `/api/auth/devices` | 연결된 기기 목록 | Access Token |
| `DELETE` | `/api/auth/devices/{deviceId}` | 기기 연결 해제 | Access Token |
| `POST` | `/api/auth/devices/push-token` | FCM/APNs 토큰 등록/갱신 | Access Token |

---

## 섹션 3 — 프론트엔드 구조 (FSD)

### 신규/변경 파일

`index.ts`는 **슬라이스 루트에만** 위치합니다 (세그먼트 내부에는 없음).
외부 레이어는 슬라이스 루트의 `index.ts`를 통해서만 접근합니다.

```
shared/
├── api/
│   └── axiosInstance.ts       # axios 인스턴스 + 인터셉터 (401 silent refresh)

entities/
├── user/
│   ├── index.ts               # export { useUserStore, type User, type UserRole, userApi }
│   ├── api/
│   │   └── userApi.ts         # GET /api/auth/me
│   └── model/
│       ├── types.ts            # User, UserRole
│       └── store.ts            # Zustand: accessToken, user, setAuth, clearAuth

features/
├── login-by-credentials/
│   ├── index.ts               # export { LoginForm, useLogin }
│   ├── api/
│   │   └── loginApi.ts        # POST /api/auth/login
│   ├── model/
│   │   └── useLogin.ts        # 로그인 mutation + 결과 분기
│   └── ui/
│       └── LoginForm.tsx

├── login-by-2fa/
│   ├── index.ts               # export { TwoFactorWaiting, useTwoFactorSocket }
│   ├── api/
│   │   └── twoFactorApi.ts    # POST /api/auth/2fa/approve, resend, backup
│   ├── model/
│   │   └── useTwoFactorSocket.ts  # WebSocket 연결 + APPROVED/DENIED/EXPIRED 처리
│   └── ui/
│       └── TwoFactorWaiting.tsx

├── logout/
│   ├── index.ts               # export { useLogout }
│   ├── api/
│   │   └── logoutApi.ts
│   └── model/
│       └── useLogout.ts

pages/
├── login/
│   ├── index.ts               # export { LoginPage, TwoFALoginPage, BackupCodePage }
│   └── ui/
│       ├── LoginPage.tsx
│       ├── 2FALoginPage.tsx
│       └── BackupCodePage.tsx # /login/2fa/backup

└── register/
    ├── index.ts               # export { RegisterPage, BackupCodeIssuePage }
    └── ui/
        ├── RegisterPage.tsx         # /register/:token
        └── BackupCodeIssuePage.tsx  # /register/backup-codes
```

### 라우팅 (app/providers/router/config.tsx)

```ts
// 인증 불필요
{ path: '/login',                 element: <LoginPage /> }
{ path: '/login/2fa',             element: <TwoFALoginPage /> }
{ path: '/login/2fa/backup',      element: <BackupCodePage /> }
{ path: '/register/:token',       element: <RegisterPage /> }
{ path: '/register/backup-codes', element: <BackupCodeIssuePage /> }

// 인증 필요 (PrivateRoute)
{ path: '/drive', element: <PrivateRoute><DrivePage /></PrivateRoute> }
```

### Silent Refresh 흐름

```
앱 초기 진입
  └─ accessToken 없음
      └─ POST /api/auth/refresh (Cookie 자동 전송)
          ├─ 성공: setAuth(token, user) → 요청 페이지 진입
          └─ 실패: navigate('/login')

401 응답 인터셉터
  └─ POST /api/auth/refresh 재시도
      ├─ 성공: 원래 요청 재시도
      └─ 실패: clearAuth() + navigate('/login')
```

### useLogin.ts 분기 로직

```ts
login(credentials)
  └─ 응답 status 분기
      ├─ 200: setAuth() → navigate('/drive')
      └─ 202: navigate('/login/2fa', { state: { challengeId, code } })
```

---

## 섹션 4 — 백엔드 구조 (Spring Boot)

### 패키지 구조

```
com.terab.api/
├── TeraBApplication.java
│
├── auth/
│   ├── controller/
│   │   └── AuthController.java
│   ├── service/
│   │   ├── AuthService.java
│   │   ├── TwoFactorService.java
│   │   └── InvitationService.java
│   ├── websocket/
│   │   └── TwoFactorWebSocketHandler.java
│   ├── dto/
│   │   ├── LoginRequest.java
│   │   ├── LoginResponse.java
│   │   ├── TwoFactorChallengeResponse.java
│   │   └── RegisterRequest.java
│   └── repository/
│       ├── RefreshTokenRepository.java
│       ├── TwoFaChallengeRepository.java
│       ├── TrustedDeviceRepository.java
│       ├── BackupCodeRepository.java
│       └── InvitationRepository.java
│
├── user/
│   ├── domain/
│   │   └── User.java
│   ├── repository/
│   │   └── UserRepository.java
│   └── service/
│       └── UserService.java
│
├── rbac/
│   ├── domain/
│   │   ├── Role.java
│   │   └── Permission.java
│   ├── repository/
│   │   └── RoleRepository.java
│   └── service/
│       └── RbacService.java
│
├── device/
│   ├── domain/
│   │   └── Device.java
│   ├── controller/
│   │   └── DeviceController.java
│   └── repository/
│       └── DeviceRepository.java
│
└── security/
    ├── SecurityConfig.java
    ├── JwtProvider.java
    ├── JwtAuthenticationFilter.java
    ├── CustomUserDetails.java
    ├── CustomUserDetailsService.java
    └── WebSocketSecurityConfig.java
```

### 빌드 설정

```groovy
// settings.gradle
rootProject.name = 'terab-api'

// build.gradle
group = 'com.terab'
```

### 로그인 흐름 (AuthService.java)

```
login(username, password, deviceId?):
  1. UserRepository.findByUsername()
  2. BCrypt.matches(password, user.password)   → 실패 시 401
  3. user.isActive 확인                        → 비활성 시 423
  4. TrustedDeviceRepository.isValid(deviceId) → 신뢰기기이면 5번 스킵
  5. TwoFactorService.createChallenge(userId)
     → DB 저장 + MQ에 Push 알림 발행
     → 202 { challengeId, code } 반환
  6. 신뢰기기: AccessToken + RefreshToken 발급
     → RefreshToken HttpOnly Cookie Set
     → 200 { accessToken, user } 반환
```

### Spring Security 필터 체인

```
permitAll():
  POST /api/auth/login
  POST /api/auth/register
  GET  /api/auth/invitations/**
  POST /api/auth/2fa/approve
  GET  /ws/auth/2fa/**
  GET  /api/shares/**

authenticated(): 나머지 /api/**

필터: JwtAuthenticationFilter → SecurityContext 등록
```

### 2FA WebSocket (TwoFactorWebSocketHandler.java)

```
연결: /ws/auth/2fa/{challengeId}
  → sessions Map<challengeId, WebSocketSession> 등록

모바일 POST /api/auth/2fa/approve:
  → approved: true  → JWT 발급 후 WebSocket 전송 { type: "APPROVED", accessToken }
  → approved: false → { type: "DENIED" }

만료 스케줄러 (@Scheduled, 1분 주기):
  → 만료 challenge WebSocket에 { type: "EXPIRED" } 전송 후 연결 종료
```

### 초기 OWNER 계정 자동 생성

```
ApplicationRunner: 환경변수 OWNER_USERNAME, OWNER_PASSWORD, OWNER_NICKNAME
users 테이블이 비어있을 때만 OWNER 계정 생성
```

---

## 섹션 5 — 에러 처리 + 보안 체크리스트

### 에러 응답 표준 형식

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
  "timestamp": "2026-03-31T10:00:00Z"
}
```

| HTTP | code | 상황 |
|------|------|------|
| 401 | `INVALID_CREDENTIALS` | username/password 불일치 |
| 401 | `TOKEN_EXPIRED` | Access Token 만료 |
| 401 | `TOKEN_INVALID` | 토큰 변조/형식 오류 |
| 401 | `REFRESH_TOKEN_INVALID` | Refresh Token 만료/폐기 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `INVITATION_NOT_FOUND` | 초대 토큰 없음/만료 |
| 409 | `USERNAME_TAKEN` | 중복 username |
| 410 | `CHALLENGE_EXPIRED` | 2FA 챌린지 만료 |
| 423 | `ACCOUNT_DISABLED` | 비활성화된 계정 |

### 보안 체크리스트

**인증/토큰**
- [ ] bcrypt cost factor 12 이상 (password, token_hash, backup_code_hash)
- [ ] Access Token 만료 15분, Refresh Token 만료 7일
- [ ] Refresh Token 원문 저장 금지 — token_hash(bcrypt)만 DB 저장
- [ ] Refresh Token rotation — 사용 시 기존 폐기 + 신규 발급
- [ ] 로그아웃 시 해당 device의 Refresh Token 즉시 폐기

**2FA**
- [ ] challengeId는 UUID, code는 서버 생성
- [ ] 챌린지 만료 5분, used_at 기록으로 재사용 방지
- [ ] 모바일 approve API는 자신의 challengeId만 처리 (userId 검증)
- [ ] 백업코드 8개, 1회 사용 후 used_at 기록

**HTTP / Cookie**
- [ ] Refresh Token Cookie: `HttpOnly; Secure; SameSite=Strict`
- [ ] CORS 허용 origin: `drive.skypark207.com`, `admin.drive.skypark207.com` (와일드카드 금지)
- [ ] HTTPS 강제 (Nginx HTTP → HTTPS 리다이렉트)

**계정**
- [ ] 로그인 실패 5회 → 계정 잠금 + 관리자 알림
- [ ] 초대 토큰 만료 48시간, 1회 사용 후 accepted_at 기록

### 프론트엔드 에러 처리

```
LoginForm:
  INVALID_CREDENTIALS → "아이디 또는 비밀번호를 확인해 주세요" (인라인)
  ACCOUNT_DISABLED    → "비활성화된 계정입니다. 관리자에게 문의하세요"

TwoFactorWaiting:
  CHALLENGE_EXPIRED   → /login 리다이렉트 + 토스트
  WebSocket 연결 끊김  → 재연결 1회 시도 후 /login 리다이렉트

Silent Refresh 실패:
  → clearAuth() + /login 리다이렉트 (토스트 없이)
```

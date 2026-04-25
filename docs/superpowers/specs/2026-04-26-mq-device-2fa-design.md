# MQ 서비스 구축 + Device / 2FA / TrustedDevice NestJS 이식 설계

**목표:** Java(Spring Boot)에서 구현된 Push 2FA 기능을 NestJS 스택으로 완성한다. MQ 서비스를 NestJS + BullMQ로 신규 구축하고, API 서비스에 Device·2FA·TrustedDevice 도메인을 추가한다.

**관련 개발 항목:** DEV-012, DEV-014, DEV-015, DEV-018

---

## 전체 아키텍처

```
[API 서비스]                    [Redis]                [MQ 서비스]
  login()                          │                     BullMQ Worker
  → TwoFaModule                    │                     → FcmService → FCM
    → enqueue('push-challenge') ───┤──────────────────▶  (job 완료 시 로깅)
  → return 2FA_REQUIRED            │

[PC 브라우저]
  3초 폴링 → GET /api/auth/2fa/challenge/:id/status

[모바일 앱]
  FCM 딥링크 → POST /api/auth/2fa/challenge/:id/respond
```

---

## 인프라 변경

| 항목 | 현재 | 변경 후 |
|------|------|--------|
| 메시지 브로커 | RabbitMQ (잔존, 미사용) | Redis (BullMQ) |
| RabbitMQ | docker-stack.yml 잔존 | 제거 |
| MQ 서비스 | 주석 처리됨 | NestJS 서비스로 신규 구축 |
| Redis | 없음 | 신규 추가 |

**서비스 디렉토리:**
```
services/
  api/          # 기존 (NestJS)
  mq/           # 신규 (NestJS, BullMQ worker 전용)
  web/
  nginx/
```

---

## Task 1: MQ 서비스 구축

### 역할

HTTP 엔드포인트 없음. BullMQ worker 전용 NestJS 앱. FCM Push 발송만 담당.

### 모듈 구조

```
services/mq/src/
  push/
    push.worker.ts        # @Processor('push-challenge')
    push.module.ts
    fcm/
      fcm.service.ts      # FirebaseMessaging 래핑
      fcm.module.ts
  health/
    health.controller.ts  # GET /health — Docker healthcheck 전용
  app.module.ts
  main.ts
```

### BullMQ Job 페이로드

큐 이름: `push-challenge`

```typescript
interface PushChallengeJob {
  userId: string;
  pushToken: string;
  challengeId: string;
  options: string;      // 예: "47,82,13"
  expiresAt: string;    // ISO 8601
}
```

### 처리 흐름

```
PushWorker.process(job)
  → FcmService.send(pushToken, { challengeId, options, expiresAt })
  → FCM Message (data payload + deeplink)
  → job 성공/실패 BullMQ 자동 기록
```

### 실패 처리

- 재시도: `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`
- 최종 실패 시 `failed` 상태로 Redis 보존 → `getJob()` 로 로그 조회 가능

### FCM 메시지 구조

```typescript
{
  token: pushToken,
  data: {
    type: '2FA_CHALLENGE',
    challengeId,
    options,           // "47,82,13"
    expiresAt,
    deeplink: `/auth/2fa/${challengeId}`,
  },
  notification: {
    title: '로그인 승인 요청',
    body: '모바일 앱에서 숫자를 선택해 로그인을 승인해 주세요.',
  },
}
```

### 환경변수

```
REDIS_HOST
REDIS_PORT
FIREBASE_CREDENTIAL_PATH   # Docker secret 파일 경로
```

---

## Task 2: Device 도메인 (API)

### Drizzle 스키마

```typescript
// services/api/src/database/schema/devices.schema.ts
devices: {
  id: uuid PK default gen_random_uuid(),
  userId: uuid FK → users NOT NULL,
  pushToken: text NOT NULL,
  userAgent: varchar(500),
  createdAt: timestamptz NOT NULL default now()
}
```

### API 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/devices | 필요 | 디바이스 등록 (pushToken) |
| GET | /api/devices | 필요 | 내 디바이스 목록 |
| DELETE | /api/devices/:id | 필요 | 디바이스 제거 |

### 모듈 구조

```
services/api/src/device/
  device.controller.ts
  device.service.ts
  device.repository.ts
  dto/
    register-device.dto.ts
    device-response.dto.ts
  device.module.ts
```

### 제약

- 동일 pushToken 중복 등록 시 upsert (토큰 갱신 시나리오 대응)
- 타인의 디바이스 삭제 시 403

---

## Task 3: 2FA + TrustedDevice 도메인 (API)

### Drizzle 스키마 2개 추가

```typescript
// two-fa-challenges.schema.ts
two_fa_challenges: {
  id: uuid PK,
  userId: uuid FK → users NOT NULL,
  options: varchar(20) NOT NULL,     // "47,82,13"
  correctNum: varchar(2) NOT NULL,
  status: varchar(10) NOT NULL default 'PENDING',
  createdAt: timestamptz NOT NULL,
  expiresAt: timestamptz NOT NULL,
  respondedAt: timestamptz
}

// trusted-devices.schema.ts
trusted_devices: {
  id: uuid PK,
  userId: uuid FK → users NOT NULL,
  tokenHash: varchar(64) NOT NULL,   // SHA-256
  userAgent: varchar(500),
  expiresAt: timestamptz NOT NULL,   // 생성 시점 + 30일
  createdAt: timestamptz NOT NULL
}
```

### 2FA 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/auth/2fa/challenge/:id/status | `@Public` | PC 폴링 (3초 간격) |
| POST | /api/auth/2fa/challenge/:id/respond | 필요 | 모바일 숫자 선택 |
| POST | /api/auth/2fa/challenge/:id/resend | `@Public` | 챌린지 재발송 |

### TrustedDevice 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/trusted-devices | 필요 | 신뢰기기 목록 |
| DELETE | /api/trusted-devices/:id | 필요 | 신뢰기기 해제 |

### 챌린지 생성 로직

- 2자리 숫자 3개 무작위 생성 (10–99), `SecureRandom` 상당의 `crypto.randomInt`
- `options`: "47,82,13" 형식 문자열
- `correctNum`: options 중 무작위 1개
- `expiresAt`: 생성 시점 + 60초

### 상태 전이

```
PENDING → APPROVED  (모바일이 correctNum 선택)
PENDING → DENIED    (모바일이 오답 선택)
PENDING → EXPIRED   (60초 초과, status 폴링 시 markExpired 호출)
```

### options 타입 변환

- DB 및 Job 페이로드: `"47,82,13"` (문자열)
- API 응답 및 LoginResponseDto: `["47", "82", "13"]` (string[])
- TwoFaService에서 `options.split(',')` 변환 담당

### respond 보안 규칙

- 이미 처리(APPROVED/DENIED/EXPIRED)된 챌린지 → 204 반환 (브루트포스 방지: 맞음/틀림 미노출)
- 챌린지 소유자 != 요청 사용자 → 403

### 모듈 구조

```
services/api/src/
  twofa/
    twofa.controller.ts
    twofa.service.ts
    twofa.repository.ts
    dto/
      challenge-status-response.dto.ts
      respond-challenge.dto.ts
    twofa.module.ts
  trusted-device/
    trusted-device.controller.ts
    trusted-device.service.ts
    trusted-device.repository.ts
    dto/
      trusted-device-response.dto.ts
    trusted-device.module.ts
```

---

## Task 4: login() 2FA 분기 완성

### 분기 흐름

```
login(dto, cookies)
  1. 자격증명 검증 (기존 로직 유지)
  2. TrustedDeviceService.verify(trustToken 쿠키, userId)
     → 유효 → 즉시 토큰 발급 (2FA 스킵)
  3. DeviceService.findByUserId(userId) → pushToken 있는 것만 필터
     → 빈 배열 → 즉시 토큰 발급 (2FA 스킵)
  4. TwoFaService.createChallenge(userId)
     → BullMQ enqueue('push-challenge', payload) — 각 디바이스마다
     → return LoginResponseDto.twoFactorRequired(challengeId, options, expiresAt)
```

### trustToken 쿠키 등록 흐름

```
POST /api/auth/2fa/challenge/:id/respond { selectedNumber, trustDevice: true }
  → 정답 + trustDevice === true
  → TrustedDeviceService.register(userId, rawToken, userAgent)
  → Set-Cookie: trustToken=<rawToken>; HttpOnly; SameSite=Strict; Max-Age=2592000
```

### LoginResponseDto 확장

```typescript
class LoginResponseDto {
  static authenticated(accessToken: string, user: UserResponseDto): LoginResponseDto
  static twoFactorRequired(
    challengeId: string,
    options: string[],
    expiresAt: Date,
  ): LoginResponseDto
}
```

`status` 필드: `null`(authenticated) | `'2FA_REQUIRED'`

---

## 테스트 전략

| 대상 | 방식 |
|------|------|
| TwoFaService (옵션 생성, 상태 전이) | Unit (Jest + mock repository) |
| TrustedDeviceService (verify, register) | Unit (Jest + mock repository) |
| DeviceService | Unit (Jest + mock repository) |
| MQ PushWorker | Unit (Jest + mock FcmService) |
| TwoFaController | Integration (supertest, DB 없이 service mock) |
| login() 2FA 분기 | Unit (AuthService, mock TwoFaService + DeviceService) |

---

## 파일 맵 요약

### 신규 생성

```
services/mq/                                   # NestJS BullMQ worker 서비스 전체

services/api/src/database/schema/
  devices.schema.ts
  two-fa-challenges.schema.ts
  trusted-devices.schema.ts

services/api/src/
  device/                                      # 전체 모듈
  twofa/                                       # 전체 모듈
  trusted-device/                              # 전체 모듈
```

### 수정

```
services/api/src/auth/auth.service.ts          # login() 2FA 분기
services/api/src/auth/auth.controller.ts       # respond 시 trustToken 쿠키 Set
services/api/src/auth/dto/login-response.dto.ts # twoFactorRequired factory 추가
services/api/src/database/schema/index.ts      # 신규 스키마 re-export
services/api/src/app.module.ts                 # 신규 모듈 등록
docker-stack.yml                               # RabbitMQ 제거, Redis + mq 서비스 추가
docker-stack.local.yml                         # 동일
CLAUDE.md                                      # notification → mq 명칭 수정
```

# 2FA Fallback Strategy 설계 — TOTP / Passkey / Backup Code 통합

작성일: 2026-05-19
대상: services/api (auth + twofa) + services/web
유형: feature design (정책 결정 + 다단계 구현)
선행: `2026-05-19-trust-token-ux-design.md` §9.2 분리 항목

## 1. 배경

`finish-specs/2026-05-19-trusted-device-2fa-bypass-verification-design.md`(bug 3) 종결 시점에 식별된 정책 결함과 `trust-token-ux-design` §9.2에서 분리된 항목을 본 spec에서 다룬다.

### 1.1 현재 상태

- 2FA는 **push 방식 단일**: 이미 로그인된 다른 device가 challenge에 응답하는 구조 (`twofa.service.ts`, `useTwoFactorPolling.ts`)
- backup code(`POST /auth/login/backup`)가 일회용 fallback로 존재하나 push와 통합돼 있지 않고 별도 페이지로 분기
- backup code 로직은 `src/backup-code/` 별도 모듈로 분리돼 있음 (controller 없음 — BackupCodeService + BackupCodeRepository만)
- TOTP·Passkey·email 등 다른 인증 strategy 없음

### 1.2 결함 시나리오

| 시나리오 | 결과 |
|---|---|
| 사용자의 마지막 신뢰기기 trust가 만료 + 응답 가능한 device 부재 | 영구 락아웃 (backup code 미보관 시) |
| 모바일 분실 + push 응답 불가 | login 자체 불가 |
| 새 device로 첫 로그인 시 push를 받을 device가 없음 | onboarding deadlock |

trust-token-ux의 sliding expiry + 90일 cap이 만료 빈도를 줄여주지만 **궁극적으로 fallback strategy 없이는 락아웃을 완전 차단할 수 없다.**

## 2. 요구사항

### 2.1 기능

- 사용자가 등록한 strategy 중 하나를 선택해 2FA challenge에 응답할 수 있다
- 본인 계정에 어떤 strategy가 등록돼 있는지 확인할 수 있다 (보안 설정)
- 새 strategy를 추가·해제할 수 있다 (비밀번호 재확인 필요)
- challenge 시작 시 사용자가 strategy를 선택 (default는 push, fallback 진입은 명시적 click)

### 2.2 보안 정책

| 항목 | 정책 |
|---|---|
| strategy 등록·해제 | 현재 비밀번호 재확인 필수 |
| TOTP 등록 | secret 생성 → QR/manual 표시 → 1회 검증 코드 입력 성공 시에만 enable |
| Passkey 등록 | 표준 WebAuthn registration ceremony (attestation 검증) |
| 최소 strategy 수 | push 외 1개 이상 보유 강제 — backup code 보유도 충족으로 인정 (§3) |
| Throttle | strategy 등록 60s/3, challenge 응답 60s/5 |
| Rate limit | TOTP 검증 5회 연속 실패 시 5분 잠금 (브루트포스 차단). TOTP는 user당 1개이므로 사용자 단위 잠금 |

### 2.3 분리되는 strategy

| Strategy | RFC/표준 | 비고 |
|---|---|---|
| Push (기존) | 자체 구현 | 이미 구현 — 통합 인터페이스에 흡수 |
| TOTP | RFC 6238 (HOTP/TOTP) | `otplib` 사용 (RFC 6238 준수, 활성 maintain) |
| Passkey | WebAuthn (Level 2) | `@simplewebauthn/server` |
| Backup Code (기존) | 자체 구현 | 이미 부분 구현 — Phase 0에서 `src/backup-code/`를 `src/twofa/`로 흡수 후 strategy 인터페이스에 통합 |
| Email magic link | 자체 구현 | SMTP 인프라 부재 — 본 spec 외 |

## 3. 결정 사항 (2026-05-19 확정)

| 항목 | 결정 |
|---|---|
| 도입 strategy 범위 | **TOTP + Passkey** — email은 SMTP 인프라 부재로 제외, SMS는 spoofing 위험으로 제외 |
| 구현 단계 분할 | **strategy 별 분리** — Phase 0(refactor) → Phase 1(TOTP) → Phase 2(Passkey). 각 Phase 독립 머지 가능 |
| backup code 보관 유도 | **권장 알림** — 첫 strategy 등록 완료 화면에서 "backup code도 소지하세요" 모달, 강제는 아님 |
| 최소 strategy 수 | **push 외 1개 이상 강제** — backup code 보유도 "1개"로 카운트(이미 regenerate 가능하므로 지속 fallback으로 인정). 마지막 push 외 strategy 제거 시 `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` |
| 등록된 strategy 노출 | **상세** — `type`, `createdAt`, `lastUsedAt` 포함. 본인 계정 설정 화면이라 PII 위험 낮음 |
| challenge 응답 UX | **명시적 선택 후 진입** — default는 push 화면, '다른 방법으로' 버튼 → strategy 선택 리스트. 자동 fallback 없음 |
| **backup-code 모듈 흡수** | **`src/backup-code/` 전체를 `src/twofa/`로 이동** — controller가 없는 도메인이므로 상위 feature로 흡수. 결과: `src/twofa/backup-code.service.ts` + `src/twofa/backup-code.repository.ts` + `src/twofa/strategies/backup-code.strategy.ts`가 BackupCodeService 주입 |
| **TOTP 다중 등록** | **불가** — `two_fa_totp`에 `unique(user_id)` 제약. 같은 secret을 여러 authenticator에 동기화하는 일반 관행 따름 |
| **Passkey 다중 등록** | **허용** — WebAuthn 표준대로 폰 + USB 보안키 + 노트북 등 다중 credential 허용 |
| **TOTP secret encryption** | **`api.env`의 `TWOFA_MASTER_KEY`로 envelope encryption** — 32바이트 base64. SecurityModule에 `EncryptionService` 추가. AES-256-GCM. 운영은 Docker Swarm이 환경변수로 주입 |
| **Passkey mobile 대응** | **Phase 2는 web 우선 머지** — Capacitor Android 호환은 **별도 PoC spec으로 분리**. PoC 통과 전 mobile 사용자는 TOTP/backup-code fallback 사용. Phase 2 머지는 mobile PoC와 무관하게 진행 가능 |

## 4. 아키텍처

### 4.1 추상화

```ts
interface TwoFaStrategy<Setup, Challenge, Response> {
  readonly type: 'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE';

  // 등록 (setup ceremony)
  startSetup(userId: string): Promise<Setup>;
  completeSetup(userId: string, payload: unknown): Promise<void>;

  // challenge 생성
  createChallenge(userId: string): Promise<Challenge>;

  // challenge 응답 검증
  verifyResponse(userId: string, challengeId: string, payload: Response): Promise<boolean>;

  // 사용자가 등록한 instance 조회·해제
  list(userId: string): Promise<Array<{ id: string; createdAt: Date; lastUsedAt: Date | null }>>;
  revoke(userId: string, id: string): Promise<void>;
}
```

- 각 구현체: `PushTwoFaStrategy`, `TotpTwoFaStrategy`, `PasskeyTwoFaStrategy`, `BackupCodeTwoFaStrategy`
- `TwoFaStrategyRegistry`: type → instance 매핑. `TwoFaService`가 type 기반 디스패치
- push·backup-code는 setup ceremony 개념이 없으므로 `startSetup`/`completeSetup` 호출 시 `TWOFA_SETUP_NOT_SUPPORTED` throw (Phase 0에 ErrorCode 함께 추가). 인터페이스의 일관성을 위해 메서드 시그니처는 유지하되 런타임에 차단 — TOTP/Passkey만 setup ceremony 의미가 있음

### 4.2 Module 구조 (Phase 0 결과)

```
src/twofa/
  twofa.module.ts                   # 모든 strategy + Registry + 통합 service 등록
  twofa.service.ts                  # Registry 디스패치 + challenge orchestration
  twofa.controller.ts               # 등록·해제·list (strategy-agnostic)
  backup-code.service.ts            # Phase 0: src/backup-code/에서 이관
  backup-code.repository.ts         # Phase 0: src/backup-code/에서 이관
  push-challenge.publisher.ts       # 기존 유지
  twofa.repository.ts               # 기존 (push challenge 테이블)
  dto/
    ...
  strategies/
    twofa-strategy.interface.ts
    twofa-strategy.registry.ts
    push.strategy.ts                # Phase 0: 기존 twofa.service 로직을 strategy로 분리
    backup-code.strategy.ts         # Phase 0: BackupCodeService 주입
    totp.strategy.ts                # Phase 1
    passkey.strategy.ts             # Phase 2
  challenge.controller.ts           # Phase 1 도입 — POST /auth/2fa/challenge/:id/complete
```

- `src/backup-code/`는 Phase 0에서 **삭제**
- `auth.controller.ts`의 `POST /auth/login/backup`은 Phase 0 시점에는 그대로 두고 내부 호출만 `TwoFaService`(또는 BackupCodeService) 경유로 변경 (행위 변경 없음 = 회귀 차단)

### 4.3 Schema

새 테이블 (TOTP·Passkey 각각):

```sql
two_fa_totp(
  id uuid pk, user_id uuid fk users(id) cascade,
  secret_encrypted bytea not null,   -- AES-256-GCM envelope encryption (TWOFA_MASTER_KEY)
  iv bytea not null,                  -- per-row IV (12 bytes for GCM)
  auth_tag bytea not null,            -- GCM auth tag (16 bytes)
  algorithm varchar(16) not null default 'SHA1',
  digits int not null default 6,
  period_sec int not null default 30,
  created_at timestamptz, last_used_at timestamptz null,
  unique(user_id)                     -- TOTP는 user당 1개
)

two_fa_passkey(
  id uuid pk, user_id uuid fk users(id) cascade,
  credential_id bytea unique not null,
  public_key bytea not null,
  sign_count bigint not null,
  transports varchar(64)[] not null default '{}',
  aaguid uuid null,
  created_at timestamptz, last_used_at timestamptz null
)
```

- `backup_codes` 테이블은 그대로 유지 (Phase 0의 모듈 이동은 schema 영향 없음)
- push 관련 schema(`two_fa_challenges`, `push_subscriptions` 등)는 기존 유지

### 4.4 ErrorCode

추가:

| Key | Status | 사유 |
|---|---|---|
| `TWOFA_STRATEGY_NOT_FOUND` | 404 | 등록되지 않은 strategy로 challenge 요청 (Phase 0) |
| `TWOFA_SETUP_NOT_SUPPORTED` | 400 | push·backup-code 등 setup ceremony가 없는 strategy에 setup 호출 (Phase 0) |
| `TWOFA_TOTP_INVALID_CODE` | 400 | 코드 mismatch (Phase 1) |
| `TWOFA_TOTP_LOCKED` | 429 | 5회 연속 실패 잠금 (Phase 1) |
| `TWOFA_PASSKEY_VERIFICATION_FAILED` | 400 | WebAuthn 검증 실패 (Phase 2) |
| `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` | 400 | 최소 1개 정책 위반 (Phase 1 — 등록·해제 도입 시점) |

## 5. 단계별 implementation 계획

### 5.1 Phase 0 — 인터페이스 도입 + backup-code 흡수 (refactor only)

**목표:** strategy 추상화 도입 + 기존 행위 100% 보존 (회귀 0)

**작업 범위:**
- `TwoFaStrategy` 인터페이스 + `TwoFaStrategyRegistry`
- 기존 push 로직을 `PushTwoFaStrategy`로 이관 (`twofa.service.ts`의 `createChallenge`/`respond`/`getStatus`/`resend`)
- `src/backup-code/` 전체를 `src/twofa/`로 이동:
  - `backup-code.module.ts` 삭제
  - `backup-code.service.ts`, `backup-code.repository.ts`, `*.spec.ts` 모두 `src/twofa/`로 이동
  - `auth.module.ts`/`AppModule`의 BackupCodeModule import 제거
  - `TwoFaModule`이 BackupCodeService를 export하고, `AuthModule`이 TwoFaModule을 import해 `AuthService`가 BackupCodeService를 직접 주입받는 형태 유지 (`POST /auth/login/backup` 경로·동작 무변경)
- `BackupCodeTwoFaStrategy` 작성 — BackupCodeService 주입, `verifyResponse`가 기존 backup login 로직과 동일하게 동작 (login 진입은 Phase 1 통합 endpoint 도입 시 이 strategy 경유로 전환, Phase 0 시점에는 기존 auth login 경로 + strategy 인터페이스 둘 다 BackupCodeService에 도달)
- `TwoFaService`가 Registry를 통해 type 기반으로 디스패치
- 외부 contract(URL, request/response body) **변경 없음**

**테스트:**
- 기존 `twofa.service.spec.ts`/`twofa.controller.spec.ts`/`auth.controller.spec.ts`의 push·backup 케이스가 행위 변경 없이 통과
- 신규: Registry 디스패치 단위 테스트 (`type → strategy` 매핑 검증, 미등록 type 시 throw)
- 신규: `BackupCodeTwoFaStrategy`·`PushTwoFaStrategy` adapter가 기존 service 로직과 동등하게 동작

**Plan 대상 = 본 Phase 0** (별도 spec 분리 없이 본 spec 단독 plan)

### 5.2 Phase 1 — TOTP (별도 spec/plan)

- `two_fa_totp` 테이블 + migration
- `otplib` 도입
- SecurityModule에 `EncryptionService` 추가 (AES-256-GCM, key는 `TWOFA_MASTER_KEY` 환경변수 base64 디코드)
- `api.env.example` + `api.env`에 `TWOFA_MASTER_KEY` 추가
- API: `POST /auth/2fa/totp/setup/start`, `POST /auth/2fa/totp/setup/complete`, `DELETE /auth/2fa/totp/:id`
- challenge: `POST /auth/2fa/challenge/:id/complete` body에 `{ type: 'TOTP', code: '123456' }` (이 시점에 `challenge.controller.ts` 도입)
- web: 설정 페이지 TOTP 등록 UI (QR + manual key) + login 화면 TOTP 입력 진입
- Lockout: 사용자 단위 5회/5분, Redis 기반

### 5.3 Phase 2 — Passkey (별도 spec/plan)

- `two_fa_passkey` 테이블 + migration
- `@simplewebauthn/server` 도입
- RP ID·origin 환경 변수 (`api.env`에 `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_ORIGIN` 추가)
- API: registration ceremony 2단계 + authentication ceremony 2단계
- challenge: `{ type: 'PASSKEY', credentialResponse: ... }`
- web: WebAuthn 표준 ceremony 통합
- **mobile은 별도 PoC spec으로 분리** (`2026-XX-XX-passkey-capacitor-compat-design.md`). Phase 2 web 머지는 PoC와 무관하게 진행 가능

## 6. 테스트

### 6.1 단위 (각 strategy)

| Strategy | 케이스 |
|---|---|
| Push (Phase 0 이관) | 기존 케이스 100% 통과, adapter 경유 시에도 동일 결과 |
| BackupCode (Phase 0 이관) | 기존 케이스 100% 통과, strategy 인터페이스 호출 시 동일 결과 |
| TOTP (Phase 1) | secret 생성·검증, 시간 window(±1 step) 허용, 5회 실패 잠금, 잠금 만료 후 재시도 가능, encryption round-trip |
| Passkey (Phase 2) | counter rollback 거부, credential reuse 거부, attestation 검증 실패 거부 |
| Registry | 미등록 type 요청 시 `TWOFA_STRATEGY_NOT_FOUND` |
| Removal guard | 마지막 push 외 strategy 제거 시 `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` (backup-code 보유는 카운트) |

### 6.2 e2e

- Phase 0: 기존 push login + backup login flow 회귀 없음
- Phase 1: TOTP setup → login(push 미사용, TOTP 코드) → 성공 / 5회 실패 → 잠금 → 6번째 시도 차단
- Phase 2: Passkey 등록 → 동일 credential 재등록 거부

## 7. 스코프 외

- email magic link (SMTP 인프라 부재)
- SMS 2FA (통신비·spoofing 위험)
- security key(USB FIDO2)는 Passkey 흐름에 자연 포함됨
- backup code regenerate 자체는 `2026-05-19-backup-code-regenerate-design`에서 처리 완료 — 본 spec은 strategy 인터페이스에 흡수만 다룬다
- Passkey의 Capacitor Android 호환 PoC는 별도 spec에서 다룬다

## 8. 종속

- trust-token-ux Phase가 종결된 뒤 진행 권장 (동일 모듈 변경 충돌 회피)
- `auth-domain-decomposition`(2026-05-19 종결) 이후 진행 — auth 도메인 분해가 끝났으므로 `src/twofa/`는 이미 독립 모듈로 자리잡음
- Phase 1·2는 Phase 0 완료 후 순차 진행 (strategy 인터페이스 의존)

## 9. 작업 산출물 체크리스트

- [x] §3 결정 항목 사용자 확인 (2026-05-19 확정 — 신규 결정 포함)
- [ ] **Phase 0 (본 spec의 write-plan 대상)**: `TwoFaStrategy` 인터페이스 + Registry + push 이관 + backup-code 모듈 흡수 + 회귀 0 보장
- [ ] Phase 1: TOTP — 별도 spec/plan (스키마·EncryptionService·service·controller·web UI·단위·e2e)
- [ ] Phase 2: Passkey — 별도 spec/plan (스키마·service·controller·web UI·단위·e2e, mobile PoC 분리)
- [ ] ErrorCode 5종 추가는 Phase별로 필요 시점에 추가 (`TWOFA_STRATEGY_NOT_FOUND`는 Phase 0, `TWOFA_LAST_STRATEGY_CANNOT_REMOVE`는 Phase 1 등록·해제 도입 시점, TOTP·Passkey 키는 각 Phase)
- [ ] 보안 설정 페이지 (Web frontend-design 단계 — strategy 상세 노출, 등록/해제 mutation) — Phase 1 시점에 시작
- [ ] 첫 strategy 등록 완료 화면에 backup code 보관 권장 모달 — Phase 1 web 작업에 포함

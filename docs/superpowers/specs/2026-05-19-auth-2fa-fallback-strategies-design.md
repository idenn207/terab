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
| 최소 strategy 수 | 모든 strategy 해제 금지 — backup code도 함께 보관하도록 강제할지 결정 필요 (§3) |
| Throttle | strategy 등록 60s/3, challenge 응답 60s/5 |
| Rate limit | TOTP 검증 5회 연속 실패 시 5분 잠금 (브루트포스 차단) |

### 2.3 분리되는 strategy

| Strategy | RFC/표준 | 비고 |
|---|---|---|
| Push (기존) | 자체 구현 | 이미 구현 — 통합 인터페이스에 흡수 |
| TOTP | RFC 6238 (HOTP/TOTP) | `speakeasy` / `otplib` 같은 검증된 라이브러리 |
| Passkey | WebAuthn (Level 2) | `@simplewebauthn/server` 권장 |
| Backup Code (기존) | 자체 구현 | 이미 부분 구현 — 통합 인터페이스에 흡수, regenerate은 별도 spec에서 처리 완료 |
| Email magic link | 자체 구현 | SMTP 인프라 부재 — 본 spec 외 |

## 3. 결정 필요 항목 (사용자 확인)

본 spec을 implementation으로 전환하기 전 다음 결정이 필요하다.

| 항목 | 옵션 | 권장 |
|---|---|---|
| 도입 strategy 범위 | A. TOTP만 / B. TOTP + Passkey / C. TOTP + Passkey + email | **B (TOTP + Passkey)** — email은 SMTP 인프라 부재 |
| 구현 단계 분할 | 한 spec / strategy 별 분리 | **strategy 별 분리 (Phase 1: TOTP, Phase 2: Passkey)** — TOTP가 PoC 가치 큼, Passkey는 attestation·platform 복잡 |
| backup code 강제 보관 | 모든 사용자 강제 / 선택 / 권장 알림 | **권장 알림** — 첫 strategy 등록 시 "backup code도 발급하는 게 좋습니다" 모달 |
| 최소 strategy 수 정책 | 0개 허용 / 항상 1개 이상 / push 외 1개 이상 | **항상 push 외 1개 이상** (락아웃 차단 목적) |
| 등록된 strategy 노출 | 마스킹(`TOTP enabled`) / 상세 (생성일·last used) | **상세** — 사용자 본인 화면이라 PII 위험 낮음 |
| challenge 응답 UX | strategy 선택 후 진입 / 자동 fallback (push 타임아웃 → TOTP) | **선택 후 진입** — 자동 fallback은 의도하지 않은 strategy 노출 가능성 |

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

### 4.2 Module 구조

```
src/twofa/
  twofa.module.ts
  twofa.service.ts                  # registry 디스패치 + challenge orchestration
  twofa.controller.ts               # 등록·해제·list (strategy-agnostic)
  challenge.controller.ts           # POST /auth/2fa/challenge/:id/complete (type 분기)
  strategies/
    push.strategy.ts                # 기존 logic 이관
    totp.strategy.ts                # Phase 1
    passkey.strategy.ts             # Phase 2
    backup-code.strategy.ts         # 기존 logic 이관
    twofa-strategy.interface.ts
    twofa-strategy.registry.ts
```

### 4.3 Schema

새 테이블 (TOTP·Passkey 각각):

```sql
two_fa_totp(
  id uuid pk, user_id uuid fk users(id) cascade,
  secret_encrypted bytea not null,   -- envelope encryption (KMS or master key)
  algorithm varchar(16) not null default 'SHA1',
  digits int not null default 6,
  period_sec int not null default 30,
  created_at timestamptz, last_used_at timestamptz null
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

- backup_codes 테이블은 그대로
- push 관련 schema(`two_fa_challenges`, `push_subscriptions` 등)는 기존 유지

### 4.4 ErrorCode

추가:

| Key | Status | 사유 |
|---|---|---|
| `TWOFA_STRATEGY_NOT_FOUND` | 404 | 등록되지 않은 strategy로 challenge 요청 |
| `TWOFA_TOTP_INVALID_CODE` | 400 | 코드 mismatch |
| `TWOFA_TOTP_LOCKED` | 429 | 5회 연속 실패 잠금 |
| `TWOFA_PASSKEY_VERIFICATION_FAILED` | 400 | WebAuthn 검증 실패 |
| `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` | 400 | 최소 1개 정책 위반 |

## 5. 단계별 implementation 계획

### 5.1 Phase 0 — 인터페이스 도입 (사전 작업)

- `TwoFaStrategy` 인터페이스 + Registry
- 기존 push·backup code 로직을 strategy로 이관 (행위 변경 없음, refactor only)
- `TwoFaService`가 type 디스패치하도록 변경
- 테스트: 기존 push·backup login flow 회귀 없음

### 5.2 Phase 1 — TOTP

- `two_fa_totp` 테이블 + migration
- 라이브러리 선택 (`otplib` 권장 — 활성 maintain, RFC 6238 준수)
- secret encryption: master key envelope (`SecurityModule`에 `EncryptionService` 추가)
- API: `POST /auth/2fa/totp/setup/start`, `POST /auth/2fa/totp/setup/complete`, `DELETE /auth/2fa/totp/:id`
- challenge: `POST /auth/2fa/challenge/:id/complete` body에 `{ type: 'TOTP', code: '123456' }`
- web: 설정 페이지 TOTP 등록 UI (QR + manual key) + login 화면 TOTP 입력 진입

### 5.3 Phase 2 — Passkey

- `two_fa_passkey` 테이블 + migration
- `@simplewebauthn/server` 도입
- RP ID·origin 환경 변수 (`.env` 추가)
- API: registration ceremony 2단계 + authentication ceremony 2단계
- challenge: `{ type: 'PASSKEY', credentialResponse: ... }`
- web: Capacitor android 플랫폼 호환 점검 (WebAuthn은 WebView 환경에서 제약 — Credential Manager API 또는 platform passkey 경유 필요)

## 6. 테스트

### 6.1 단위 (각 strategy)

| Strategy | 케이스 |
|---|---|
| TOTP | secret 생성·검증, 시간 window(±1 step) 허용, 5회 실패 잠금, 잠금 만료 후 재시도 가능 |
| Passkey | counter rollback 거부, credential reuse 거부, attestation 검증 실패 거부 |
| Registry | 미등록 type 요청 시 `TWOFA_STRATEGY_NOT_FOUND` |
| Removal guard | 마지막 strategy(혹은 push 외 마지막) 제거 시 `TWOFA_LAST_STRATEGY_CANNOT_REMOVE` |

### 6.2 e2e

- TOTP setup → login(push 미사용, TOTP 코드) → 성공
- TOTP 5회 실패 → 잠금 → 6번째 시도 차단
- Passkey 등록 → 동일 credential 재등록 거부
- 마지막 push 외 strategy 제거 시도 → 거부

## 7. 스코프 외

- email magic link (SMTP 인프라 부재)
- SMS 2FA (통신비·spoofing 위험)
- security key(USB FIDO2)는 Passkey 흐름에 자연 포함됨
- backup code regenerate 자체는 `2026-05-19-backup-code-regenerate-design`에서 처리 완료 — 본 spec은 strategy 인터페이스에 흡수만 다룬다

## 8. 종속

- trust-token-ux Phase가 종결된 뒤 진행 권장 (동일 모듈 변경 충돌 회피)
- 재구조화 5(`auth-domain-decomposition`) 이전에 끝내면 strategy 폴더가 자연스럽게 함께 이동된다 — 본 spec 종료 시점의 위치는 `src/twofa/strategies/`

## 9. 작업 산출물 체크리스트

- [ ] §3 결정 항목에 대한 사용자 확인 — implementation 전 필수
- [ ] Phase 0: `TwoFaStrategy` 인터페이스 + Registry + 기존 push·backup 이관 (회귀 없음)
- [ ] Phase 1: TOTP — 스키마·service·controller·web UI·단위·e2e
- [ ] Phase 2: Passkey — 스키마·service·controller·web UI·단위·e2e (Capacitor 호환 확인 후)
- [ ] ErrorCode 5종 추가
- [ ] 보안 설정 페이지 (Web frontend-design 단계)

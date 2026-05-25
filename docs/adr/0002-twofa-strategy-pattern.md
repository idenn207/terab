---
name: twofa-strategy-pattern
description: TOTP/Push/Backup Code 3가지 2FA 방식을 Strategy 패턴 + NestJS multi-provider DI 로 통합
status: accepted
date: 2026-05-20
---

# ADR-0002: 2FA Strategy 패턴 (TOTP / Push / Backup Code)

## Status

accepted (PR #39, 커밋 37fc959 머지 — 2026-05-20)

## Context

초기 2FA 는 Push 단일 방식으로 시작했다 (PR #26, 커밋 a9284a4 — `feat: Push 2FA 서비스 구축 (DEV-012~016)`). GitHub 스타일 숫자 매칭 + FCM/APNs Push 로 동작했다.

운영하면서 다음 요구가 등장했다:

1. **모바일 앱 미설치 환경**: 신규 사용자 또는 모바일 앱을 설치하지 않은 PC 단독 사용자가 2FA 를 통과할 방법 부재 → TOTP (Google Authenticator, Authy 등 표준 RFC 6238) 필요
2. **디바이스 분실 복구 경로**: 폰 분실·교체 시 Push 도 TOTP 도 사용 불가 — `OWNER` 역할 복구가 환경변수 재발급에 의존 → Backup Code (1회용 복구 코드) 필요
3. **향후 확장 여지**: WebAuthn (passkey), SMS, Email OTP 등 추가 검토 필요 — `TwoFaStrategyType` 에 이미 `'PASSKEY'` literal 이 예약됨

각 방식은 challenge 생성·검증·만료 흐름이 **표면적으로는 유사**하지만 내부 의존이 전혀 다르다:

- **Push**: FCM/APNs 외부 호출, WebSocket 으로 PC 에 결과 전달, 챌린지 숫자 매칭
- **TOTP**: `otplib` 같은 라이브러리, TOTP secret 저장(암호화), 시간 윈도 검증, lockout 카운터(`TotpLockoutService`)
- **Backup Code**: bcrypt 비교, 1회용 소비 처리, DB row 삭제/소진 마킹

이 차이를 `auth.service.ts` 의 if-else 분기로 누적하면 다음 문제가 예측됐다:

- **결합도 폭증**: auth 도메인이 FCM, otplib, bcrypt, lockout 정책을 모두 알게 됨
- **OCP 위반**: 신규 방식 추가 시 auth.service.ts 가 매번 변경 — diff 가 인증 코어 코드와 신규 방식 코드에 동시에 발생
- **테스트 어려움**: 각 방식의 단위 테스트가 auth.service 와 결합되어 격리 불가
- **챌린지 라이프사이클 일관성 깨짐**: 각 if 분기에서 챌린지 생성·만료를 따로 구현하면 동작 drift 발생

다른 선택지 검토:

- **단순 함수 dispatcher (switch-case)**: Strategy 클래스가 없어 의존 주입(FCM client, otplib wrapper) 이 함수 인자 또는 closure 로 들어가야 함 — NestJS DI 생태계와 부조화
- **각 방식을 독립 도메인으로 분리 (`/twofa/push`, `/twofa/totp`, `/twofa/backup` controller 분리)**: 챌린지 라이프사이클·검증 결과 통보가 도메인마다 중복 구현됨
- **Plugin 시스템 (런타임 로딩)**: NestJS DI 와 마찰, 컴파일 타임 안전성 손실 — Phase 0 에서 과한 추상화

## Decision

**Strategy 패턴 + NestJS multi-provider DI** 채택.

### 인터페이스 (`twofa-strategy.interface.ts`)

```ts
export type TwoFaStrategyType = 'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE';

export interface TwoFaStrategy<TSetup = unknown, TChallenge = unknown, TResponse = unknown> {
  readonly type: TwoFaStrategyType;

  startSetup(userId: string): Promise<TSetup>;
  completeSetup(userId: string, payload: unknown): Promise<void>;

  createChallenge(userId: string): Promise<TChallenge>;
  verifyResponse(userId: string, challengeId: string, payload: TResponse): Promise<boolean>;

  list(userId: string): Promise<TwoFaStrategyInstance[]>;
  revoke(userId: string, id: string): Promise<void>;
}

export const TWOFA_STRATEGY_TOKEN = Symbol('TwoFaStrategy');
```

- 제네릭 3개 (`TSetup`, `TChallenge`, `TResponse`) 로 각 strategy 의 setup/challenge/response payload 타입 차이 흡수
- Setup ceremony 가 없는 strategy (Push, Backup Code) 는 `startSetup`/`completeSetup` 에서 `ApiException('TWOFA_SETUP_NOT_SUPPORTED')` throw

### Registry (`twofa-strategy.registry.ts`)

```ts
@Injectable()
export class TwoFaStrategyRegistry {
  private readonly map: Map<TwoFaStrategyType, TwoFaStrategy>;

  constructor(@Inject(TWOFA_STRATEGY_TOKEN) strategies: TwoFaStrategy[]) {
    this.map = new Map();
    for (const s of strategies) this.map.set(s.type, s);
  }

  get(type: TwoFaStrategyType): TwoFaStrategy {
    const strategy = this.map.get(type);
    if (!strategy) throw new ApiException('TWOFA_STRATEGY_NOT_FOUND');
    return strategy;
  }
}
```

- 생성자에서 NestJS multi-provider 로 주입된 `TwoFaStrategy[]` 를 `Map<Type, Strategy>` 로 구축
- 미등록 타입 호출 시 `ApiException` (표준 에러 응답으로 클라이언트 전달)
- 컨트롤러는 `registry.get(type)` 만 사용 — 구체 strategy 클래스 무지각

### 구현체 3종

| Strategy | 파일 | 외부 의존 |
|---|---|---|
| PushStrategy | `push.strategy.ts` | FCM/APNs (services/mq 경유), WebSocket 게이트웨이 |
| TotpStrategy | `totp.strategy.ts` | `otplib` (RFC 6238), `TotpLockoutService`, 암호화된 TOTP secret 저장 |
| BackupCodeStrategy | `backup-code.strategy.ts` | bcrypt, 1회용 소비 처리 |

### Module 등록

```ts
// twofa.module.ts (개요)
providers: [
  TwoFaStrategyRegistry,
  { provide: TWOFA_STRATEGY_TOKEN, useExisting: PushStrategy, multi: true },
  { provide: TWOFA_STRATEGY_TOKEN, useExisting: TotpStrategy, multi: true },
  { provide: TWOFA_STRATEGY_TOKEN, useExisting: BackupCodeStrategy, multi: true },
  PushStrategy, TotpStrategy, BackupCodeStrategy,
]
```

신규 strategy 추가 비용 = (1) strategy 클래스 1개 작성 + (2) module providers 에 2줄 추가.

## Consequences

### Positive

- **OCP 준수** — 신규 2FA 방식 추가 시 auth/twofa controller·service 변경 없음
- **테스트 격리** — 각 strategy 의 `*.strategy.spec.ts` 가 외부 의존(FCM, otplib, bcrypt) 만 mock 하면 됨. `push.strategy.spec.ts`, `totp.strategy.spec.ts`, `backup-code.strategy.spec.ts` 3개로 분리
- **auth 도메인 무지각화** — auth controller 는 strategy 종류·구현 무지각, registry 만 의존
- **챌린지 라이프사이클 일관성** — 모든 strategy 가 동일 `createChallenge`/`verifyResponse` 시그니처를 따르므로 라이프사이클 drift 방지
- **확장 의도 명시** — `TwoFaStrategyType` 에 `'PASSKEY'` literal 이 예약되어 향후 WebAuthn 추가 시 타입 변경 없이 strategy 클래스만 추가

### Negative

- **추상화 1겹 추가** — registry 경유로 strategy 호출. 코드 따라가기에 점프 1회 추가
- **NestJS multi-provider 학습 곡선** — `{ provide: TOKEN, useExisting: X, multi: true }` 패턴이 NestJS 신규 개발자에게 익숙하지 않음
- **cross-cutting 정책의 위치 모호함** — `TotpLockoutService` 처럼 여러 strategy 가 공유할 수 있는 정책(횟수 제한, audit log 등) 을 strategy 내부에 둘지 외부에 둘지 결정 필요
- **fallback strategy 정책 미정**: 사용자가 TOTP 디바이스 분실 시 Backup Code 로 자동 전환할지, 수동 선택할지 등 UX 결정이 별도 작업으로 미뤄짐 (`feedback_auth_2fa_fallback_pending` 기록)
- **trustToken sliding expiry 미구현**: 신뢰기기 30일 갱신 정책이 본 PR 범위 외 — 후속 작업 필요

### Mitigations

- 인터페이스 (`twofa-strategy.interface.ts`) 에 docstring 으로 setup ceremony 미지원 strategy 의 `ApiException` 약속 명시
- `TotpLockoutService` 같은 cross-cutting 정책은 strategy **외부** 별도 service 로 분리 (현재 결정) — strategy 는 도메인 검증 책임만, lockout 카운터/audit 는 외부 service 가 위임 받음
- fallback strategy 정책과 trustToken sliding expiry 는 별도 PRD 로 분리 (memory: `project_auth_2fa_fallback_pending`)

## References

- **구현 PR**: [#39](https://github.com/<owner>/<repo>/pull/39) — `feat(api): 2FA Strategy 도입 + TOTP + Auth 도메인 재구조화` (커밋 37fc959)
- **선행 결정 (Push 2FA 도입)**: [#26](https://github.com/<owner>/<repo>/pull/26) — `feat: Push 2FA 서비스 구축 (DEV-012~016)` (커밋 a9284a4)
- **선행 결정 (2FA 완료 흐름 분리)**: [#28](https://github.com/<owner>/<repo>/pull/28) — `feat: MQ 서비스 구축 및 2FA 완료 흐름 분리` (커밋 072d41e)
- **인터페이스**: [services/api/src/twofa/strategies/twofa-strategy.interface.ts](../../services/api/src/twofa/strategies/twofa-strategy.interface.ts)
- **Registry**: [services/api/src/twofa/strategies/twofa-strategy.registry.ts](../../services/api/src/twofa/strategies/twofa-strategy.registry.ts)
- **Strategy 구현 3종**:
  - [push.strategy.ts](../../services/api/src/twofa/strategies/push.strategy.ts)
  - [totp.strategy.ts](../../services/api/src/twofa/strategies/totp.strategy.ts)
  - [backup-code.strategy.ts](../../services/api/src/twofa/strategies/backup-code.strategy.ts)
- **TwoFa 모듈**: [services/api/src/twofa/twofa.module.ts](../../services/api/src/twofa/twofa.module.ts)
- **Lockout 정책 (외부 service)**: [services/api/src/twofa/totp-lockout.service.ts](../../services/api/src/twofa/totp-lockout.service.ts)

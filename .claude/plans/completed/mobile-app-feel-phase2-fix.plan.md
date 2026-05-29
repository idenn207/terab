---
name: mobile-app-feel-phase2-fix
description: PR #59 phase2 dogfood 결함 1·5 fix — 2FA complete 의 trustToken atomic 발급 + frontend mutation idempotency + 중복 컨트롤러 정리
status: in-progress
created: 2026-05-28
---

# mobile-app-feel-phase2-fix

PR #59 dogfood 결과의 5가지 결함 중 우선순위 1·5 fix. 진단 컨텍스트는 메모리 [[mobile-app-feel-phase2-dogfood]] 참조. 후속 결함(2/3/4)은 본 plan 범위 외.

## 목표

| # | 결함 | 본 plan 의 해법 |
|---|---|---|
| 1 (CRITICAL) | 2FA complete 의 mutation 다중 호출 → 첫 호출 성공 후 두 번째 호출이 `?error=2fa_failed` 로 redirect | (a) frontend `useEffect` 에 `useRef` idempotency guard + `onAuthenticated` 콜백 제거. (b) backend 가 trustToken 까지 atomic 처리해 race 표면 자체 제거 |
| 5 (SECURITY) | trustToken 발급이 별도 endpoint 의 fire-and-forget RPC — 부분 실패 시 권한 상승 | `complete` body 에 `trustDevice` 추가 → service 가 같은 트랜잭션 안에서 register + setTrustCookie |
| 보너스 #3 | `TwoFaController` 와 `ChallengeController` 가 같은 prefix `auth/2fa/challenge` 로 3개 핸들러 좀비 등록 | `TwoFaController` 및 spec 삭제, module 에서 등록 제거 |

## Files

### Backend (`services/api`)

| 파일 | 변경 |
|---|---|
| `src/twofa/dto/complete-challenge-body.dto.ts` | `trustDevice?: boolean` 추가 — `@IsBoolean() + @IsOptional()` |
| `src/twofa/challenge.controller.ts` | `complete` 메서드에 `@Headers('user-agent')` 추가, service 호출 시 `trustDevice`/`userAgent` 전달 |
| `src/twofa/twofa.service.ts` | `completeChallenge` 가 트랜잭션 안에서 `claimApprovedChallenge` + (trustDevice 시) `TrustedDeviceService.register`. `issueAuthenticatedResponse` 가 `trustDevice` 시 `setTrustCookie` |
| `src/twofa/twofa.module.ts` | `TrustedDeviceModule` import 추가, `controllers` 에서 `TwoFaController` 제거 |
| `src/twofa/twofa.controller.ts` | **파일 삭제** (중복 좀비) |
| `src/twofa/twofa.controller.spec.ts` | **파일 삭제** |
| `src/twofa/twofa.service.spec.ts` | `completeChallenge` 새 signature 에 맞춘 케이스 갱신 |
| `src/twofa/challenge.controller.spec.ts` | `complete` 의 `trustDevice=true` 분기 케이스 추가 |

### Frontend (`services/web`)

| 파일 | 변경 |
|---|---|
| `src/shared/api/generated/*` | `npm run openapi:codegen` 으로 재생성 (수동 편집 X) |
| `src/features/login-by-2fa/model/useTwoFactorPolling.ts` | (a) `completedRef = useRef(false)` 가드 추가. (b) `onAuthenticated` 콜백 매개변수 제거. (c) `trustDevice: boolean` 파라미터 추가 + `complete` body 로 전달 |
| `src/features/login-by-2fa/ui/TwoFactorWaiting.tsx` | `useTrustedDevice` import 제거, `trustChecked` 를 hook 두 번째 인자로 전달 |
| `src/features/login-by-2fa/model/useTwoFactorPolling.test.tsx` | idempotency + `trustDevice` 전달 + onAuthenticated 콜백 제거 케이스 갱신 |

### 메모리 (사용자 글로벌)

| 파일 | 변경 |
|---|---|
| `~/.claude/projects/c---project-my-terab/memory/project_auth_2fa_fallback_pending.md` | "trustToken sliding expiry 미구현" 줄 삭제 — `trusted-device.service.ts:60-67` 에 이미 구현됨 |
| `~/.claude/projects/c---project-my-terab/memory/project_mobile_app_feel_phase2_dogfood.md` | 문제 1·5 status 를 "RESOLVED" + commit hash 로 갱신 |

## Tasks

순서대로 진행. 각 task 끝 Validation 통과 후 다음으로.

### Task 1 — Backend DTO + Service signature 확장 (TDD)

1. `complete-challenge-body.dto.ts` 에 `trustDevice` 추가
2. `twofa.service.spec.ts` 에 "trustDevice=true 시 register 호출 + setTrustCookie", "trustDevice=false/undefined 시 cookie 미설정" 케이스 추가 (RED)
3. `TwoFaService` 가 `TrustedDeviceService`, `AuthService` (이미 주입 중) 활용해 트랜잭션 안에서 register + cookie 처리 (GREEN)
4. 같은 commit 안에서 `twofa.module.ts` 의 `imports` 에 `TrustedDeviceModule` 추가, `controllers` 에서 `TwoFaController` 제거

### Task 2 — Backend Controller signature 갱신 + 좀비 컨트롤러 제거

1. `challenge.controller.spec.ts` 에 complete `trustDevice=true` 분기 + userAgent 헤더 전달 케이스 (RED)
2. `challenge.controller.ts` 의 `complete` 가 body.trustDevice + Headers('user-agent') 받아 service 로 전달 (GREEN)
3. `twofa.controller.ts`, `twofa.controller.spec.ts` 삭제

### Task 3 — Frontend codegen + hook 갱신 (TDD)

1. `make api` 로 api dev 서버 띄우고 `npm --prefix services/web run openapi:codegen` 실행 — generated diff 확인 (`completeTwoFaMutation` body 타입에 `trustDevice` 등장)
2. `useTwoFactorPolling.test.tsx` 갱신:
   - "APPROVED 가 두 번 연속 도착해도 complete 는 1회만 호출" (idempotency)
   - "trustDevice=true 가 mutation body 로 전달"
   - 기존 `onAuthenticated` 관련 케이스 삭제
3. `useTwoFactorPolling.ts` 에 `useRef(false)` guard + signature 변경 + `onAuthenticated` 제거
4. `TwoFactorWaiting.tsx` 에서 `useTrustedDevice` import 제거 + signature 갱신

### Task 4 — 회귀 검증

1. `npm --prefix services/api test -- --testPathPattern=twofa`
2. `npm --prefix services/web test -- src/features/login-by-2fa`
3. `make api` 띄운 상태에서 PC + 모바일 dogfood:
   - PC 로그인 → 2FA → 모바일 응답 → PC `/drive` 진입 (성공)
   - PC `?error=2fa_failed` 미발생
   - "이 기기 신뢰" 체크 시 trustToken cookie 발급 + 다음 로그인 2FA 스킵
   - "이 기기 신뢰" 미체크 시 trustToken 미발급 + 다음 로그인 2FA 발생
   - (확장) complete 가 EXPIRED race 로 실패 시도해도 trustToken 미발급

### Task 5 — 메모리 갱신 + commit

1. 메모리 두 파일 갱신
2. commit 분리:
   - `fix: 2FA complete 가 trustToken 까지 atomic 발급` (backend)
   - `fix: useTwoFactorPolling idempotency guard 추가` (frontend)
   - `chore: TwoFaController 중복 좀비 삭제` (보너스 #3)
   - generated 산출물은 frontend hook commit 과 함께
3. PR #59 의 conversation 에 phase2 dogfood 결함 1·5 fix 코멘트

## Validation

각 commit 단계마다 통과해야 하는 조건:

- `npm --prefix services/api test` — twofa, trusted-device 도메인 spec 전체 green
- `npm --prefix services/web test` — login-by-2fa 도메인 spec 전체 green
- `npm --prefix services/api run build` — type 에러 0
- `npm --prefix services/web run build` — type 에러 0
- Manual dogfood (Galaxy Z Flip4 실기): Task 4.3 의 4가지 시나리오

## Risks

| Risk | 완화 |
|---|---|
| codegen 결과가 다른 client 호출처를 깨뜨림 | `complete` body 가 *옵셔널* `trustDevice` 만 추가 — 기존 호출은 영향 없음 |
| `TwoFaController` 삭제가 다른 곳에서 import 중일 수 있음 | grep 으로 import 0건 확인 후 삭제 |
| `TwoFaService` 가 트랜잭션 안에서 `TrustedDeviceService.register` 호출 시 `this.runInTx` nesting | `TrustedDeviceService.register` 는 자체 `runInTx` 사용 — `TransactionContext` 가 nested tx 를 지원하는지 확인 후 필요 시 `register` 의 inner 부분만 직접 호출하는 헬퍼 분리 |
| Manual dogfood race 재현 불가 | strict mode 가 dev 에서만 동작 — `useTwoFactorPolling.test.tsx` 에서 명시적으로 APPROVED 2회 emit 시뮬레이션해 idempotency 검증 |

## Acceptance

- [ ] PC 2FA 성공 시 `/drive` 진입 (`?error=2fa_failed` redirect 0건)
- [ ] "이 기기 신뢰" 체크 여부가 trustToken 발급과 1:1 일치 (불일치 0건)
- [ ] complete mutation 호출 횟수 ≤ 1 (idempotency)
- [ ] `git grep TwoFaController` 결과 0건 (좀비 제거 완료)
- [ ] 메모리 두 파일 갱신 완료
- [ ] PR #59 후속 commit 3개 push 완료

## 관련

- 진단 컨텍스트: [[mobile-app-feel-phase2-dogfood]]
- 후속 결함(미포함): 문제 2 (PC error toast 누락), 문제 3 (모달 협의), 문제 4 (logout push token deactivate)
- ADR 후보: trustToken 의 atomic 발급 정책 변경 — 본 fix 완료 후 별도 ADR 작성 검토

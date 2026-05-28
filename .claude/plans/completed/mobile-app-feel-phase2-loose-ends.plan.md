---
name: mobile-app-feel-phase2-loose-ends
description: PR #59 phase2 dogfood 결함 2·3·4 마무리 — PC 2FA 실패 banner UX + /2fa/:id modal-styled overlay + logout 시 push token device-단위 deactivate
status: completed
created: 2026-05-29
completed: 2026-05-29
---

> 실제 구현은 plan 의 결정 사항 중 **2건을 다운그레이드** 했다 — (a) Task 2 의 toast lib 신규 도입을 inline banner alert 로 대체 (services/web 에 toast lib 0건, mobile-ui-guide §2.2 의 Material Snackbar 마이그레이션은 v1.0 Milestone 2). (b) Task 3 의 backgroundLocation modal pattern 을 modal-styled overlay (fixed inset + a11y dialog role + Esc/backdrop close + 닫기 button) 로 minimum-viable 화. 진짜 modal pattern 은 별도 plan 으로 분리. Task 5 (mq push.worker active token gate) 는 이미 적용되어 있어 SKIP. 자세한 내용은 [PRPs/reports/mobile-app-feel-phase2-loose-ends-report.md](../PRPs/reports/mobile-app-feel-phase2-loose-ends-report.md) 참조.

# mobile-app-feel-phase2-loose-ends

PR #59 phase2 dogfood 의 5가지 결함 중 [[mobile-app-feel-phase2-fix]] 가 종결시킨 결함 1·5(idempotency + atomic trustToken) 의 *남은* 3건. 진단 컨텍스트는 메모리 [[project_mobile_app_feel_phase2_dogfood]] 참조.

## 목표

| # | 결함 | 본 plan 의 해법 |
|---|---|---|
| 2 (UX) | PC 가 `?error=2fa_failed` 로 redirect 되도 사용자에게 안내 없음 — LoginPage 가 silent 하게 다시 로그인 폼만 보여줌 | `LoginPage` 가 `searchParams.get('error')` 를 읽어 toast 표시 + URL cleanup. 기존 phase2-fix idempotency 후로는 *발생 빈도 자체*는 낮지만 EXPIRED race 또는 backend 실패 path 에서 잔존 — UX safety net |
| 3 (정책) | 모바일에서 푸시 클릭 → `/2fa/:id` 별도 페이지로 전체 이동 → 뒤로가기 시 `/login` (모달 협의 위반) | (a) **router-level modal pattern** — `useLocation.state.backgroundLocation` 으로 underlying route 위에 overlay. (b) deeplink 진입(backgroundLocation 없음) 은 *full-page fallback 으로 동작*하되 뒤로가기는 OS back 으로 처리 (모바일 한정) |
| 4 (보안 × UX) | 로그아웃해도 device row 가 남아 push 발송 계속 → 다른 사용자 디바이스가 알림 받음 | `POST /auth/logout` body 에 `pushToken?: string` 추가 → backend 가 *해당 device 만* deactivate. PC 측은 pushToken 미첨부라 영향 없음. Schema migration 없이 hard delete 1줄 |

### 결정 사항 (plan 단계 박제)

| 결정 | 근거 |
|---|---|
| 결함 4 는 **logout body 에 옵셔널 pushToken 첨부 → hard delete** | (a) device row 에 `deactivatedAt` 컬럼 신설하면 schema migration 필요 → PR #59 의 phase2 라벨 벗어남. (b) `device.repository.findByUserId` 가 *모든* user 의 device 를 반환하므로, 다른 user 의 device row 는 영향 없음(user_id scoped) . (c) 같은 device 의 다음 mobile boot 시 `POST /device` 자동 호출됨 — UX 단절 없음 |
| 결함 4 의 logout 신호 source 는 **client 가 자기 pushToken 을 첨부**. session ↔ device 연관 추가는 미도입 | session table 에 device_id 컬럼 추가는 OAuth-grade 변경 → 별도 plan. 본 plan 은 phase2 마무리 scope 만 |
| 결함 3 의 **2FA challenge 도 backgroundLocation 모달 패턴** 채택. 모바일 deeplink 진입은 fallback 으로 page 유지 | React Router 7 의 표준 패턴(see `useLocation.state.backgroundLocation`). underlying 화면(주로 `/drive` 또는 `/login`) 위에 overlay → 뒤로가기 자연스러움. deeplink 는 underlying 부재라 fallback 페이지 사용 |
| 결함 2 는 **`react-hot-toast` 또는 기존 toast 시스템**(아직 미확인 — Task 2.0 에서 grep) 활용. URL cleanup 은 `setSearchParams({})` | 새 toast lib 도입은 본 scope 외. 기존 시스템 그대로 사용 |

## Files

### Backend (`services/api`)

| 파일 | 변경 |
|---|---|
| `src/auth/dto/logout-body.dto.ts` | **신설** — `pushToken?: string` (optional `@IsString()` + `@MaxLength(4096)`) |
| `src/auth/login.controller.ts` | `logout` 메서드가 `@Body()` 로 `LogoutBodyDto` 받기, service 에 pushToken 전달 |
| `src/auth/login.service.ts` | `logout(rawRt, pushToken?, res)` — `revokeRefreshToken` 후 pushToken 첨부 시 `deviceService.deactivateByPushToken(userId, pushToken)` |
| `src/auth/auth.service.ts` | `revokeRefreshToken` 의 리턴 타입에 `userId` 추가 (또는 logout 측에서 별도 lookup — 기존 시그니처 확인 후 결정) |
| `src/device/device.service.ts` | `deactivateByPushToken(userId, pushToken): Promise<void>` 신설 — repository 의 deleteByUserIdAndPushToken 호출 |
| `src/device/device.repository.ts` | `deleteByUserIdAndPushToken(userId, pushToken): Promise<void>` 신설 — `and(eq(userId), eq(pushToken))` 조건 hard delete |
| `src/metadata.ts` | nest build 자동 갱신 + 수동 보정(`LogoutBodyDto`, controller logout 메서드 type) |
| `src/auth/login.controller.spec.ts` | logout pushToken 분기 케이스 추가 |
| `src/auth/login.service.spec.ts` | (존재 시) logout pushToken 전달 → deactivate 호출 케이스 |
| `src/device/device.service.spec.ts` | `deactivateByPushToken` 케이스 (호출 시 repository.delete 위임) |

### Frontend — services/web (`services/web`)

| 파일 | 변경 |
|---|---|
| `src/shared/api/generated/*` | codegen 재생성 (LogoutBodyDto 등장) |
| `src/features/logout/api/mutation.ts` | `useLogoutMutation` 이 mutate 시 body 전달 가능하도록 generated signature 적용 (기존 wrapper 그대로) |
| `src/features/logout/model/useLogout.ts` | **신설 또는 기존 확장** — Capacitor 환경 감지(`Capacitor.isNativePlatform()`) + 저장된 pushToken 첨부. PC 는 첨부 없음. logout 성공 후 client-side store cleanup |
| `src/features/logout/ui/LogoutButton.tsx` 등 | `useLogout` 호출 path 변경 (시그니처 변경 없음 — 호환) |
| `src/pages/login/ui/LoginPage.tsx` | `searchParams.get('error')` 검사 → `error === '2fa_failed'` 면 toast 표시 + `setSearchParams({})` 로 URL cleanup. `useEffect` + `useRef` guard 로 두 번 표시 방지 |
| `src/pages/login/ui/LoginPage.test.tsx` | error 쿼리 표시 case + URL cleanup case |
| `src/app/providers/router/config.tsx` | `appRoutes` 에서 `/2fa/:id` 의 element 를 modal-aware 컴포넌트로 변경. backgroundLocation 분기 처리. |
| `src/widgets/two-factor-modal/` | **신설 widget** — `useLocation` 의 state.backgroundLocation 검사 + `Routes` 안에서 동시에 underlying location 으로 routing + `/2fa/:id` 는 modal overlay |
| `src/features/login-by-2fa/model/useTwoFactorPushToken.ts` 등 | mobile 측 fcm token 의 *현재 저장된 값* getter (이미 있을 수 있음 — Task 3.0 grep) |
| `src/shared/lib/capacitor/` | (이미 있는지 grep) Capacitor 환경 helper |

### Frontend — services/mq (`services/mq`)

| 파일 | 변경 |
|---|---|
| `src/push/push.worker.ts` | empty pushTokens skip + (이미 적용? 메모리 [[mobile-app-feel-phase2-dogfood]] §결함4 의 Task 1 가드 확인 후 결정) |

### 메모리

| 파일 | 변경 |
|---|---|
| `~/.claude/projects/c---project-my-terab/memory/project_mobile_app_feel_phase2_dogfood.md` | 결함 2/3/4 status RESOLVED + commit hash |

## Tasks

순서대로 진행. 각 task 끝 Validation 통과 후 다음으로.

### Task 0 — 사전 정찰 (≤ 5분)

본 plan 이 *추정* 한 항목 중 commit 전 확실히 알아야 할 것 3가지만 grep:

1. `services/web/src` 에 **toast lib** 가 이미 있는지: `git grep -n "react-hot-toast\|sonner\|use-toast\|useToast"`
2. `services/web/src` 에 **Capacitor environment helper / push token storage**: `git grep -n "Capacitor.isNativePlatform\|PushNotifications.register\|fcm.token"`
3. `services/mq/src/push/push.worker.ts` 에 phase2 의 **empty pushToken skip** 가드가 적용됐는지: 파일 read

결과로 Task 2 (toast) / Task 4 (Capacitor logout) 의 구체 import 가 확정됨. *결과에 따라 plan 의 Files 표 수정 후* Task 1 진입.

### Task 1 — Backend: logout pushToken 첨부 + device deactivate (TDD)

1. `device.service.spec.ts` 에 `deactivateByPushToken(userId, pushToken)` 케이스 (RED)
2. `DeviceRepository.deleteByUserIdAndPushToken` + `DeviceService.deactivateByPushToken` 구현 (GREEN)
3. `login.controller.spec.ts` 에 logout body.pushToken 전달 → service.logout 호출 시그니처 확인 (RED)
4. `LogoutBodyDto` 신설 + `LoginController.logout` 이 `@Body() body: LogoutBodyDto` 받기 (GREEN)
5. `LoginService.logout(rawRt, pushToken?, res)` — `revokeRefreshToken` 후 `if (pushToken && userId) deactivateByPushToken(userId, pushToken)`
6. `metadata.ts` 수동 보정 (nest build 후 + controllers 배열 LogoutBodyDto 메타 확인)
7. api test full pass + build 0 error

### Task 2 — Frontend: LoginPage error toast + URL cleanup (TDD)

1. Task 0 의 toast lib 결정 결과로 import path 확정
2. `LoginPage.test.tsx` 에:
   - "URL 에 `?error=2fa_failed` 있으면 toast 호출 + URL cleanup"
   - "error 가 없으면 toast 호출 0"
   - "두 번 렌더되어도 toast 1회 (useRef guard)"
3. `LoginPage.tsx` 에 `useSearchParams` + `useEffect` + `useRef(false)` guard + `toast.error('2단계 인증에 실패했습니다.')` + `setSearchParams({}, { replace: true })`
4. web test full pass + build 0 error

### Task 3 — Frontend: /2fa/:id 모달 패턴 전환 (TDD)

1. Task 0 으로 *current* `/2fa/:id` 의 사용 흐름 확인:
   - 모바일 푸시 → deeplink `/2fa/:id` 진입 시 backgroundLocation 없음 → fallback 페이지 동작
   - PC 측은 `/2fa/:id` 안 씀 (PC 는 `/login/2fa` 로 polling) — 영향 없음 확인
2. `app/providers/router/config.tsx` 의 element 를 `<TwoFactorModalRoute>` 같은 wrapper 로 교체 — wrapper 가 `useLocation` 의 `state?.backgroundLocation` 검사하여:
   - backgroundLocation 존재 → 그 location 으로 underlying Routes 렌더 + modal overlay
   - 없음 → 기존 `TwoFAApprovalPage` 그대로 render (deeplink fallback)
3. `widgets/two-factor-modal/` 신설 — Modal UI + 닫기 시 backgroundLocation 으로 navigate
4. 모달 dismiss 시 polling 정리 (이미 phase2-fix 의 `useTwoFactorPolling` 이 cleanup 함수 가짐 — unmount 시 무시 OK)
5. test: 모바일 push deeplink 시 `TwoFAApprovalPage` 직접 렌더 + underlying 화면이 `/drive` 또는 `/login` 일 때 backgroundLocation 사용 시 modal overlay 검증
6. web test full pass + build 0 error

### Task 4 — Frontend: logout pushToken 첨부 + Capacitor 분기 (TDD)

1. Task 0 의 Capacitor / push token storage 결과로 fcm token 접근 path 확정
2. codegen 재생성 (`npm --prefix services/web run openapi:codegen`) — generated diff 확인
3. `features/logout/model/useLogout.ts` 의 mutate 호출 시:
   - Capacitor.isNativePlatform() → 저장된 pushToken 첨부
   - PC → pushToken 미첨부 (body 옵셔널)
4. 기존 LogoutButton 사용처에서 useLogout signature 호환성 확인
5. test (useLogout): mobile env mock 시 pushToken 첨부, web env mock 시 미첨부
6. web test full pass + build 0 error

### Task 5 — MQ: push.worker.ts active token gate 재확인

1. `services/mq/src/push/push.worker.ts` 의 `pushTokens.length === 0` skip 가드가 이미 적용됐는지 확인 (메모리 [[mobile-app-feel-phase2-dogfood]] §결함4 의 Task 1 잔여분)
2. 없으면 1줄 가드 추가 + worker spec 갱신
3. mq test full pass + build 0 error

### Task 6 — 회귀 검증

1. `npm --prefix services/api test`
2. `npm --prefix services/web test`
3. `npm --prefix services/mq test`
4. 양쪽 `npm run build`
5. manual dogfood (Galaxy Z Flip4):
   - 시나리오 A (결함 2): PC 에서 2FA 실패 유도 → `?error=2fa_failed` 진입 시 toast 표시 + URL cleanup
   - 시나리오 B (결함 3): 모바일 푸시 클릭 → /2fa/:id 모달로 표시, 닫기/취소 시 underlying 으로 복귀. PC 에서 직접 URL 진입 시 fallback page
   - 시나리오 C (결함 4): 모바일 logout 후 PC 로그인 시도 → 모바일이 push 받지 않음. 모바일 재로그인 → push 정상 수신

### Task 7 — 메모리 갱신 + commit

1. `~/.claude/projects/c---project-my-terab/memory/project_mobile_app_feel_phase2_dogfood.md` 의 결함 2/3/4 status 를 RESOLVED + commit hash 로 갱신
2. commit 분리:
   - `fix(api): logout 이 pushToken 받아 device hard delete` (Task 1)
   - `fix(web): LoginPage 가 2fa_failed 쿼리에 toast 표시` (Task 2)
   - `feat(web): /2fa/:id 를 backgroundLocation 모달 패턴으로 전환` (Task 3 + widget 신설)
   - `fix(web): mobile logout 시 push token 첨부` (Task 4)
   - `fix(mq): push worker 의 empty token skip 가드` (Task 5, 잔여 시)
   - generated 산출물은 Task 4 commit 과 동봉
3. `feat/mobile-app-feel` push → PR #59 후속 코멘트

## Validation

각 commit 단계마다 통과 조건:

- `npm --prefix services/api test` — auth, device 도메인 spec 전체 green
- `npm --prefix services/web test` — login-by-2fa, logout, pages/login 도메인 spec 전체 green
- `npm --prefix services/mq test` (Task 5 시) — push 도메인 spec 전체 green
- 각 `npm run build` — type 에러 0
- Manual dogfood (Galaxy Z Flip4 실기): Task 6.5 의 시나리오 A/B/C

## Risks

| Risk | 완화 |
|---|---|
| 결함 3 의 modal pattern 이 기존 push deeplink flow 를 깸 | wrapper 가 backgroundLocation 부재 시 *기존 TwoFAApprovalPage 그대로 render* — deeplink fallback 보존 |
| logout body 가 *옵셔널 pushToken* 인데 codegen 후 다른 client 깨짐 | optional 필드 추가는 backward-compatible — PC web 도 동작 |
| 결함 4 의 hard delete 가 *다른 device 까지 영향* | repository 의 condition 이 `userId AND pushToken` 둘 다 — 다른 device row 영향 없음. spec 으로 검증 |
| Capacitor pushToken storage 위치 미파악 — Task 0 grep 결과에 따라 plan 수정 필요 | Task 0 이 *plan 수정 권한* 있음. grep 결과로 Files 표 갱신 후 Task 1 진입 |
| 모달 패턴이 a11y(focus trap, escape key) 부족하면 web/mobile-ui-guide.md §2.2 위반 | Modal 컴포넌트는 `shared/ui/modal/` (또는 catalyst dialog) 활용 — focus trap + escape 자동 |

## Acceptance

- [ ] PC `?error=2fa_failed` 진입 시 toast 1회 표시 + URL `/login` 으로 cleanup
- [ ] 모바일 push 클릭 시 `/2fa/:id` 가 modal 로 표시 (backgroundLocation 사용) — underlying `/drive` 또는 `/login` 유지. deeplink (앱 cold start) 진입 시 fallback page 동작
- [ ] 모바일 logout 후 PC 로그인 시도 → 해당 모바일이 push 받지 않음 (device row hard deleted)
- [ ] 모바일 재로그인 → push 정상 수신 (POST /device 재등록)
- [ ] `git grep "?error=2fa_failed" services/web/src` 결과: 발신처(useTwoFactorPolling) + 수신처(LoginPage) 각 1건 이상
- [ ] 메모리 [[project_mobile_app_feel_phase2_dogfood]] 갱신 완료
- [ ] PR #59 후속 commit 5개 push 완료

## 관련

- Plan 직전: [[mobile-app-feel-phase2-fix]] (결함 1·5 RESOLVED)
- 진단 컨텍스트: [[project_mobile_app_feel_phase2_dogfood]]
- 후속 plan (별도 worktree): `auth-lifecycle` (결함 6 refreshToken auto-login + 결함 7 모바일 첫 로그인 trust UX)
- ADR 후보: 본 plan 이후 *modal 패턴* 을 catalyst dialog 외 standard 로 박제하면 ADR 작성 검토

---
name: auth-lifecycle
description: refreshToken silent auto-login + 모바일 첫 로그인 trust UX — 모바일 앱의 인증 수명주기 완성
status: in-progress
created: 2026-05-29
---

# auth-lifecycle PRD

## Problem

**P1 (모바일 cold-start UX 단절)**: 사용자가 로그아웃하지 않은 채 앱을 종료 → 재시작 시 cookie 에 유효한 refreshToken 이 있음에도 `/login` 페이지로 강제 이동. 매번 username/password 재입력 요구 — 모바일 앱 본연의 *세션 영속* 경험 부재.

**P2 (모바일 첫 로그인의 trust UX 부재)**: 모바일에서 *처음 로그인* 시 2FA 단계 없음 (push 발송할 device 미등록 상태) → AUTHENTICATED 즉시 진입. 이 path 에는 "이 기기 신뢰" 체크박스 노출 자리가 없음 → 사용자가 모바일을 trust device 로 등록할 수단 없음 → 이후 PC 등 다른 기기 로그인 시 *매번 2FA 진행* (모바일 push 응답 필요).

## Hypothesis

**H1**: web `AppShell` 또는 boot guard 가 mount 시 `useUserStore.accessToken` 부재 + cookie 의 refreshToken 존재 시 `POST /auth/refresh` silent 호출. 성공 시 accessToken store + `/drive` 직진. 실패 시 기존대로 `/login`. 모바일 앱 cold start UX 가 *세션 자동 복구* 로 전환.

**H2**: backend `POST /auth/login` body 에 옵셔널 `trustDevice` 추가. response 가 AUTHENTICATED 즉시 path 에서도 (2FA path 와 동일하게) trustToken 발급. frontend `LoginForm` 에 trust 체크박스 노출. 모바일 첫 로그인 시 사용자가 선택 → trust cookie 등록 → 이후 *모든* 다른 기기 로그인이 2FA 스킵.

## Scope

### IN

- web: `AppShell` 또는 별도 boot guard 의 silent refresh — accessToken 부재 + boot path 가 `/login` 이 아닐 때 시도. 결과 따라 navigate.
- backend: `LoginBodyDto` 에 옵셔널 `trustDevice?: boolean` + `userAgent` header. `LoginService.login` 의 AUTHENTICATED 직진 path 에서도 trustDevice=true 시 `TrustedDeviceService.register` + `setTrustCookie`. 트랜잭션 안에서 atomic.
- frontend: `LoginForm` 에 trust 체크박스 UI. 기존 `TrustThisDeviceCheckbox` 컴포넌트 재사용. mutate body 에 trustDevice 전달.
- spec: backend login.service.spec.ts 의 trust 분기 + frontend LoginForm.test.tsx 의 trust 체크 case + AppShell boot guard 의 silent refresh case.

### OUT

- Refresh endpoint 신설 — 이미 `POST /auth/refresh` 존재. 호출 path 만 추가.
- 모바일 첫 로그인의 별도 onboarding flow (trust 강제 추천 등) — UX 협의 별도. 본 PRD 는 *체크박스 노출* 만.
- silent refresh 실패 시 에러 처리 외 별도 retry/backoff — 단순 fallback `/login`.
- session ↔ device 연관 강화 — Plan A 의 결정 그대로 (session-device coupling 은 OAuth-grade 변경).

## Acceptance

- [ ] 모바일 logout 안 한 채 앱 강제 종료 후 재시작 → `/drive` 로 자동 진입 (`/login` 노출 0)
- [ ] cookie 에 refreshToken 없거나 만료 → 기존대로 `/login` 노출
- [ ] 모바일 첫 로그인 시 "이 기기 신뢰" 체크박스 노출 + 체크 시 trustToken cookie 발급
- [ ] 모바일 첫 로그인에서 trust 체크 → PC 로그인 시 *2FA 스킵* (trustToken 검증 통과 → AUTHENTICATED)
- [ ] PC 로그인은 *체크박스 미체크 default* 유지 (sensitive device 가정)
- [ ] 모든 기존 spec 유지 — silent refresh / trust 분기 spec 추가만

## Delivery Milestones

| M | 작업 | Validation |
|---|---|---|
| M1 (backend) | LoginBodyDto.trustDevice + LoginService.login atomic register + setTrustCookie | api test full pass + build |
| M2 (web boot guard) | AppShell 또는 신규 RootBoot 가 silent refresh 시도 | web test + Capacitor 환경 mock |
| M3 (web LoginForm) | TrustThisDeviceCheckbox 통합 + mutate body | web test + LoginForm.test.tsx |
| M4 (회귀 + commit + push) | 5 commits + 별도 PR | manual dogfood (Galaxy Z Flip4) |

## Risks

| Risk | 완화 |
|---|---|
| AppShell silent refresh 가 `/login` 페이지에서 동작 → 무한 loop | guard: pathname 이 `/login`/`/register` 면 skip. accessToken 이미 있으면 skip |
| silent refresh 가 PC web 에서도 동작 — 의도와 무관 | PC web 도 같은 boot guard 동작 OK (cookie 가 있으면 활용). Capacitor 분기 불필요 |
| login response 의 trustToken 발급이 2FA path 와 *시점이 다름* (즉시 vs 챌린지 후) | login 의 AUTHENTICATED 즉시 path 에서도 같은 atomic 패턴 — `issueAuthenticatedResponse` 와 동일 흐름 |
| login `userAgent` header 가 *Capacitor WebView 에서 비정상* | DeviceService.register 도 userAgent optional — TrustedDeviceService.register 도 optional 가정. spec 으로 검증 |
| trust 체크박스가 *PC default checked* 되면 보안 약화 | default unchecked + 사용자가 명시 선택. 본 PRD 의 명시 결정 |

## Open Questions (구현 시작 전 결정)

| Q | 결정안 |
|---|---|
| silent refresh 의 trigger 위치 — AppShell 안 vs 별도 guard | **AppShell 안에 useEffect** — 새 guard 도입은 router 구조 변경 필요. AppShell 가 mount 시 1회 시도. |
| boot guard 의 fallback path — `/login` 으로 navigate vs 그대로 유지 | **현재 location 유지** — silent refresh 실패는 사용자 행동 없이 진행. 이미 `/login` 이면 변화 없음. 다른 location (e.g. `/drive`) 에서 실패하면 PrivateRoute 가 알아서 `/login` 으로 redirect. |
| 첫 로그인의 trust 체크박스 위치 — LoginForm 내부 vs 별도 step | **LoginForm 내부** — 2FA path 의 `TwoFactorWaiting` 와 동일 UI 패턴. 별도 step 도입은 onboarding 협의 별도. |

## 관련

- Preceded by: [[mobile-app-feel-phase2-loose-ends]] (PR #59 결함 2·3·4 종결)
- 추가 컨텍스트: [[project_auth_2fa_fallback_pending]] (TOTP/passkey fallback — 결함 1·2 아직 PENDING, 본 PRD 무관)

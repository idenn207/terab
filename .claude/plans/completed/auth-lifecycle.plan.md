---
name: auth-lifecycle
description: backend login 에 trustDevice atomic + web AppShell silent refresh boot guard + LoginForm trust 체크박스
status: in-progress
created: 2026-05-29
prd: ../prds/auth-lifecycle.prd.md
---

# auth-lifecycle plan

[[auth-lifecycle PRD]] 의 4개 milestone 구현.

## 목표

| # | 결함 | 해법 |
|---|---|---|
| 6 (UX) | 모바일 cold-start 시 refreshToken 유효해도 `/login` 으로 강제 이동 | web `AppShell` 의 useEffect 가 boot 시 *accessToken 부재 + cookie refreshToken 존재* 상태에서 `POST /auth/refresh` silent 호출. 성공 시 store 갱신 + navigate. 실패 시 현재 location 유지 (PrivateRoute 가 알아서 처리) |
| 7 (보안 × UX) | 모바일 첫 로그인의 *2FA 우회 path* 에 trust 체크박스가 없음 → 모바일을 trust device 등록 수단 부재 | (a) backend `LoginBodyDto` 에 옵셔널 `trustDevice?: boolean` 추가 + `LoginService.login` 의 AUTHENTICATED 직진 path 에서도 trustDevice=true 시 `TrustedDeviceService.register` + `setTrustCookie` atomic. (b) frontend `LoginForm` 에 `TrustThisDeviceCheckbox` 통합 + mutate body 에 trustDevice 전달 |

## Files

### Backend (`services/api`)

| 파일 | 변경 |
|---|---|
| `src/auth/dto/login-body.dto.ts` | `trustDevice?: boolean` 추가 (`@IsOptional() @IsBoolean()`) |
| `src/auth/login.controller.ts` | `login` 메서드는 이미 `body`, `trustToken`, `userAgent`, `res` 받음 — body 의 trustDevice 가 자동 전달됨 |
| `src/auth/login.service.ts` | `login` 의 AUTHENTICATED 직진 2가지 분기 (`trustToken 우회` + `pushToken 없음`) 에서 `body.trustDevice` 시 `TrustedDeviceService.register` 호출 + `AuthService.setTrustCookie`. 트랜잭션 안에서 atomic (이미 trust 우회 path 에는 trustDevice 가 의미 없으므로 *pushToken 없음 path* + *2FA path* 가 본 대상. 2FA path 는 이미 phase2-fix 의 complete 에서 처리됨 — 본 plan 은 *pushToken 없음 AUTHENTICATED 직진 path* + *trustToken 우회 후 갱신* 검토) |
| `src/auth/login.service.spec.ts` | trustDevice 분기 케이스 추가 |
| `src/auth/login.controller.spec.ts` | userAgent header + trustDevice body 전달 검증 (기존 케이스 확장) |
| `src/metadata.ts` | nest build 자동 갱신 |

### Frontend (`services/web`)

| 파일 | 변경 |
|---|---|
| `src/app/providers/AppShell.tsx` | useEffect 안에서 silent refresh 시도. accessToken 부재 + pathname 이 auth 진입 routes (`/login`, `/register`) 아닐 때만. `POST /auth/refresh` 응답 성공 시 store 갱신. 실패 시 현재 location 유지 |
| `src/features/login-by-credentials/api/mutation.ts` | 기존 wrapper 유지 — body 의 trustDevice 가 옵셔널이라 generated signature 후 동작 |
| `src/features/login-by-credentials/model/useLogin.ts` 또는 ui/LoginForm.tsx | trustChecked state 추가 + mutate body 에 trustDevice 전달 |
| `src/features/login-by-credentials/ui/LoginForm.tsx` | `TrustThisDeviceCheckbox` import 후 form 안에 노출 + state 관리 |
| `src/features/login-by-credentials/ui/LoginForm.test.tsx` | trust 체크 → mutate body 에 trustDevice=true 전달 검증 |
| `src/app/providers/AppShell.test.tsx` (있으면 갱신, 없으면 신설) | silent refresh 분기 (accessToken 있음 → skip / cookie 부재 → skip / refresh 성공 → store 갱신 / refresh 실패 → 현재 location 유지) |
| `src/shared/api/generated/*` | codegen 재실행 (LoginBodyDto.trustDevice 등장). 단, generated 의 logout body 도 같이 갱신되어 Plan A 의 `body as any` cast 제거 가능 — 본 plan 은 v0.1 base 라 logout cast 자체가 없음. login body 만 갱신 |

### 메모리

| 파일 | 변경 |
|---|---|
| `~/.claude/projects/c---project-my-terab/memory/project_auth_2fa_fallback_pending.md` | 결함 6·7 해결 (또는 별도 신규 메모리 — 본 plan 의 worktree/PR/commit 박제) |

## Tasks

### Task 1 — Backend login trustDevice 옵셔널 + AUTHENTICATED 직진 path 의 atomic register (TDD)

1. `login-body.dto.ts` 에 `trustDevice?: boolean` 추가 (`@IsOptional() @IsBoolean()`)
2. `login.service.spec.ts` 에 케이스 추가 (RED):
   - "pushToken 없음 AUTHENTICATED 직진 path 에서 trustDevice=true 시 register + setTrustCookie"
   - "trustDevice=false/undefined 시 register/cookie 호출 안 함"
   - "trustToken 우회 path 에서 trustDevice 무관 (이미 trust 등록되어 있으므로 갱신만 — 본 plan 에서는 미도입)"
3. `login.service.ts` 의 AUTHENTICATED 직진 path 에 atomic register 추가 (GREEN)
4. `login.controller.spec.ts` userAgent header 전달 검증 (이미 받음, 갱신 없을 수도)
5. api test full pass + build 0 error

### Task 2 — Frontend AppShell silent refresh boot guard (TDD)

1. `AppShell.test.tsx` 신설 또는 갱신:
   - "accessToken 있음 → silent refresh skip"
   - "pathname `/login` 또는 `/register` → skip"
   - "cookie 없음 (refresh 401) → 현재 location 유지"
   - "refresh 성공 → store 의 accessToken/user 갱신"
2. `AppShell.tsx` 에 useEffect 추가 — codegen 의 `loginControllerRefresh` 또는 axios direct 호출. 결과 처리
3. web test full pass + build 0 error

### Task 3 — Frontend LoginForm 의 trust 체크박스 + body 첨부 (TDD)

1. `LoginForm.test.tsx` 갱신:
   - "trust 체크 시 mutate body 에 trustDevice=true 전달"
   - "default 미체크 — body 에 trustDevice 없음 또는 false"
2. `LoginForm.tsx` 에 `TrustThisDeviceCheckbox` 통합 + state 관리 + mutate body
3. web test full pass + build 0 error

### Task 4 — codegen 재실행 + 잔여물 정리

1. api dev server background 띄움
2. `npm --prefix services/web run openapi:codegen`
3. generated diff 확인 (LoginBodyDto.trustDevice 등장)
4. AppShell / LoginForm 의 `body as any` cast 가 있다면 제거
5. web test full pass + build 0 error

### Task 5 — 회귀 검증

1. `npm --prefix services/api test`
2. `npm --prefix services/web test`
3. api/web build
4. manual dogfood (Galaxy Z Flip4):
   - 시나리오 A (결함 6): 모바일 logout 안 한 채 종료 → 재시작 → `/drive` 직진
   - 시나리오 B (결함 7): 모바일 첫 로그인 시 trust 체크 → PC 로그인 시 2FA 스킵 (trustToken 검증 통과)

### Task 6 — 메모리 + commit + push

1. 메모리 갱신 (auth-lifecycle 의 PR/commit 박제)
2. commit 분리:
   - `feat(api): login 에 trustDevice 옵셔널 + AUTHENTICATED 직진 path atomic register`
   - `feat(web): AppShell silent refresh boot guard`
   - `feat(web): LoginForm 에 trust 체크박스 + body 첨부`
   - `chore(web): codegen 재실행 — LoginBodyDto.trustDevice`
   - `docs(plan): auth-lifecycle plan archive`
3. `feat/auth-lifecycle` push → 별도 PR 생성

## Validation

- `npm --prefix services/api test` — auth, trusted-device 도메인 전체 green
- `npm --prefix services/web test` — login-by-credentials, app/providers 전체 green
- api/web build 0 error
- Manual dogfood (Galaxy Z Flip4): Task 5.4 의 시나리오 A/B

## Risks

| Risk | 완화 |
|---|---|
| silent refresh 가 `/login` 페이지에서 동작 → 무한 loop | guard: pathname `/login`/`/register` 면 skip, accessToken 이미 있으면 skip |
| 모바일 첫 로그인의 trustDevice 가 진짜 register 되는지 — userAgent 가 Capacitor WebView 에서 비정상 | TrustedDeviceService.register 도 userAgent optional — spec 으로 검증 |
| codegen 안 하면 frontend 의 generated body type 에 trustDevice 부재 → mutate 호출 타입 에러 | Task 4 의 codegen 실행. 안 되면 `body as any` cast 임시 |
| login 의 `userAgent` header 가 LoginController.login 의 4번째 param — 이미 존재. 확인만 | 기존 시그니처 활용 |

## Acceptance

- [ ] backend login response 가 trustDevice=true 시 trustToken cookie 발급 (AUTHENTICATED 직진 path)
- [ ] backend login response 가 trustDevice=false/undefined 시 trustToken cookie 미발급
- [ ] web AppShell mount 시 cookie 의 refreshToken 으로 silent refresh — 성공 시 store 갱신
- [ ] web LoginForm 에 trust 체크박스 노출 + mutate body 에 전달
- [ ] 모바일 logout 안 한 채 종료 → 재시작 → `/drive` 직진 (manual)
- [ ] 모바일 첫 로그인 trust 체크 → PC 로그인 시 2FA 스킵 (manual)
- [ ] feat/auth-lifecycle push + 별도 PR 생성

## 관련

- PRD: [[auth-lifecycle PRD]]
- 진단 컨텍스트: [[project_mobile_app_feel_phase2_dogfood]] (결함 1·2·3·4·5 모두 RESOLVED — 본 plan 은 결함 6·7)
- Plan A: [[mobile-app-feel-phase2-loose-ends]] (PR #59 동봉)

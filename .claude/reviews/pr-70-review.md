# PR Review: #70 — feat(admin): M3 사용자 목록·초대 화면 (API + Web)

**Reviewed**: 2026-05-30
**Author**: 박동민 (idenn207)
**Branch**: `feat/admin-m3-users-invite-list` → `v0.1`
**Decision**: **REQUEST CHANGES** (CRITICAL 1건 — CI 빌드 차단)

---

## Summary

Admin M3 — services/api 에 admin 도메인 모듈을 신설하고 services/admin 에 사용자 목록·초대 UI 를 FSD 4계층으로 얹는 패치. ADR-0006 (옵션 A: `/admin` prefix + 신규 모듈) 의 첫 구현이며, 동반 보강으로 `extract-public-paths.mjs` 의 method-aware 리팩토링이 들어가 mixed-security path 사고를 차단. 코드 자체는 잘 설계됐고 테스트도 spec/component 모두 잘 작성됐지만, **rebase 시 metadata.ts 의 hand-merge 가 v0.1 의 형식 자체가 바뀐 사실을 놓쳐 CI 빌드를 차단**하고 있어 머지 불가. 추가로 user/admin 모듈 경계가 한 군데서 역전돼 있고, ADR 의 옵션 A 결정과 기존 `POST /invitations` 가 잔존하는 gap 이 있어 후속 정리가 필요.

---

## Findings

### CRITICAL

**[C-1] `metadata.ts` 의 stale `TwoFaController` import — CI API 빌드 차단**

- **위치**: [services/api/src/metadata.ts:503](services/api/src/metadata.ts#L503)
- **증상**:
  ```
  src/metadata.ts(24,12764): error TS2307: Cannot find module './twofa/twofa.controller'
  ```
- **원인**: PR base (`8938dc0`) 위로 #62 (auth-lifecycle: twofa.controller → challenge.controller + totp.controller + backup-code.controller 분리) 가 들어오면서 v0.1 의 `metadata.ts` 가 **23줄 minified 형식으로 완전히 재생성**됐는데, 본 PR 의 hand-merge 는 그 형식 전환을 인지하지 못하고 *#62 이전의 574줄 pretty-printed 형식* 위에 admin 컨트롤러 entry 만 surgical 추가. 그 결과 *물리적으로 존재하지 않는* `./twofa/twofa.controller` 의 import 가 lines 502-511 에 남아 있음.
- **PR 본문의 자기 평가 오류**: 작성자는 "drift 위험 낮음 — 그래도 머지 직후 재생성 결과와 1:1 비교 권장" 이라고 적었지만, 실제로는 **drift 가 *형식 자체* 에서 발생**해 빌드 단계에서 즉시 차단.
- **해결책 (권장 순)**:
  1. **정공법**: `cd services/api && npm run build` 실행 → nest CLI 가 `metadata.ts` 를 v0.1 의 23줄 minified 형식으로 자동 재생성 (admin 컨트롤러 entry 자연스럽게 포함) → 결과 commit.
  2. **최소 surgical**: [services/api/src/metadata.ts:502-511](services/api/src/metadata.ts#L502-L511) 의 `TwoFaController` 블록만 삭제. 빌드는 통과하지만 형식 drift (574줄 vs v0.1 의 23줄) 가 남아 다음 metadata 재생성 PR 에서 거대한 diff 가 발생할 예정 — 권장하지 않음.
- **머지 차단 사유**: API CI 가 빨강이고 NAS 배포 워크플로 (Build & Push) 가 자동 SKIP 되어 운영 반영 불가.

---

### HIGH

**[H-1] Web CI 실패는 base drift — rebase 로 해결**

- **위치**: PR 의 `services/web/src/features/{trash-purge,trash-restore}/` (PR 이 직접 수정하진 않음)
- **증상**: Web CI 의 `trash-purge/usePurgeTrashItem.ts(21,58)` 등 6건 type error.
- **원인**: PR merge-base 가 `8938dc0` (#68 머지 직후, #69 머지 직전) 인데, v0.1 의 최신 commit `e4342e9` 가 정확히 그 trash-purge/restore 6건을 fix 한 PR #69 의 머지 결과. 본 PR branch 가 #69 *직전* 의 base 에 묶여 있어 PR diff 외 영역에서 stale 코드가 web CI 를 break.
- **해결책**: `git rebase v0.1` 또는 `git merge v0.1` 후 force-with-lease push. PR 코드 변경 0건.
- **사용자 컨텍스트 메시지와 일치**: "web은 v0.1 branch 최신코드 사용시 해결" — 정확히 base drift 임. **본 PR 의 코드 결함 아님.**

**[H-2] user/admin 모듈 경계 역전 — `UserService` 가 admin DTO 를 import**

- **위치**: [services/api/src/user/user.service.ts:5](services/api/src/user/user.service.ts#L5)
  ```typescript
  import { AdminUserListResponseDto, ListUsersQueryDto } from '../admin/dto';
  ```
- **문제**: 모듈 의존성 방향은 `admin → user` (admin 이 user 의 service 를 사용) 가 자연스러운데, *user 가 admin 의 DTO 에 의존*하는 역방향이 생김. AdminModule 이 UserModule 을 import 하면서 동시에 UserModule 의 코드가 admin DTO 를 알게 되어 **잠재적 순환 위험** + admin 화면 변경이 user module 을 흔드는 *layering 위반*.
- **권장 fix (둘 중 하나)**:
  - DTO 이동: `admin/dto/admin-user-list.dto.ts` + `admin/dto/list-users-query.dto.ts` → `user/dto/` 로 이동 (admin 이 user 의 DTO 를 import 하는 정방향).
  - 또는 service 시그니처 변경: `UserService.listUsers` 가 도메인 객체 (`{ items: AdminUserRow[], total }` + roles map) 만 반환, 매핑/DTO 조립은 `UserAdminController` 책임.
- ADR-0006 §"Decision" 의 "신규 admin 전용 service / repository 는 원칙적으로 신설하지 않는다 — 기존 도메인 service 의 메서드 추가가 우선" 조항과는 정합. 하지만 *DTO 의 위치 결정*은 ADR 가 다루지 않음 — 본 PR 에서 의도된 결정인지 unintended 인지 명확히 박제 필요.

**[H-3] ADR-0006 옵션 A 채택 vs 기존 `POST /invitations` 잔존 — endpoint 이중 노출**

- **위치**:
  - 기존: [services/api/src/invitation/invitation.controller.ts:13-19](services/api/src/invitation/invitation.controller.ts#L13-L19) (`POST /invitations`, `user:invite`, 동일 로직)
  - 신규: [services/api/src/admin/invitation-admin.controller.ts:12-18](services/api/src/admin/invitation-admin.controller.ts#L12-L18) (`POST /admin/users/invitations`, `user:invite`, 동일 위임)
- **문제**: ADR-0006 이 옵션 A (admin 전용 모듈 + `/admin` prefix) 를 명시적으로 채택했고 옵션 B (도메인 controller 에 admin 메서드 혼재) 의 단점을 정직하게 적어놓았는데, 본 PR 머지 시점에서 두 path 가 *동시* 노출됨. 같은 비즈니스 액션이 두 경로로 노출되면:
  - 권한 게이트 변경 시 두 곳 동기화 부담
  - rate-limit 정책 분기 시 audit 사각지대
  - OpenAPI 상 admin SDK 분리 효과 반감 (ADR-0006 Positive #2)
- **권장 fix**: 두 옵션 중 하나를 본 PR 또는 즉시 후속 PR 에서:
  - (a) `InvitationController.create` 제거 (옵션 A 완수). services/web 가 `/invitations` POST 를 호출하는지 grep 필요.
  - (b) `@deprecated` JSDoc + Swagger `x-deprecated: true` + 후속 PR 일정 박제 (정리 deferred).
- 현재는 PR 본문도 ADR 도 어느 방향인지 명시하지 않음. 후속 plan 에 박제 권장.

---

### MEDIUM

**[M-1] Admin 통합/E2E 테스트 부재 — PermissionGuard 동작 미검증**

- **위치**: [services/api/src/admin/*.spec.ts](services/api/src/admin/)
- **현황**: 두 controller spec 모두 *unit test* 만 — `Test.createTestingModule({ controllers: [...], providers: [{ provide: UserService, useValue: { listUsers: jest.fn() }}] })` 로 PermissionGuard/JwtAuthGuard 가 wiring 되지 않은 채 controller method 를 직접 호출. 즉 "`user:read` 권한 없는 사용자가 `/admin/users` 호출 시 403" 같은 *행동* 은 본 PR 의 어떤 spec 도 검증하지 않음.
- **위험**: admin endpoint 는 권한 게이트가 *전부*. unit test 가 controller 의 위임 로직만 보고, guard 우회 가능성 (예: `@RequirePermission` decorator 누락, guard 등록 순서 오류) 을 잡아내지 못함.
- **권장**: 후속 PR 에 supertest 기반 E2E (`describe('PermissionGuard for /admin/*')`) 또는 `Test.createTestingModule({ providers: [JwtAuthGuard, PermissionGuard, ...]})` 기반 통합 spec 1~2건 추가. M3 의 acceptance gate 까지는 본 PR 의 unit test 로 충분하지만 risk 박제 필요.

**[M-2] `roleNames` 정렬 비결정성**

- **위치**: [services/api/src/auth/role/role.service.ts:27-39](services/api/src/auth/role/role.service.ts#L27-L39)
  ```typescript
  for (const { userId, name } of rows) {
    const existing = result.get(userId);
    if (existing) existing.push(name);
    else result.set(userId, [name]);
  }
  ```
- **문제**: `findRoleNamesByUserIds` 의 SQL 에 `ORDER BY` 없음 → PostgreSQL 은 결정성 순서를 보장하지 않음. 동일 사용자라도 호출마다 `roleNames` 가 `['ADMIN', 'OWNER']` 와 `['OWNER', 'ADMIN']` 으로 다를 수 있음. UI 의 `Intl.ListFormat` 출력이 불안정해지고 spec snapshot 도 깨질 위험.
- **권장 fix**: [services/api/src/auth/role/role.repository.ts:42-47](services/api/src/auth/role/role.repository.ts#L42-L47) 에 `.orderBy(userRoles.userId, roles.name)` 추가. 한 줄.

**[M-3] Pagination UI 부재 + unbounded `users` count**

- **위치**:
  - [services/admin/src/pages/admin/users/ui/AdminUsersPage.tsx](services/admin/src/pages/admin/users/ui/AdminUsersPage.tsx) — pagination 컨트롤 없음
  - [services/api/src/user/user.repository.ts:41-44](services/api/src/user/user.repository.ts#L41-L44) — `SELECT count(*) FROM users` (unbounded)
- **문제**:
  - UI 가 default `limit=50` 만 호출, 51번째 사용자부터 노출 안 됨. NAS 환경의 user 수가 50 이하라는 *암묵 전제* 가 코드 어디에도 박제되지 않음.
  - `count()` 가 soft-delete 컬럼 여부와 무관하게 *모든* 행 카운트. soft-delete 가 향후 도입되면 inconsistent total.
- **권장**: Plan 의 acceptance 가 "최소 행동 가능 화면" 이라 *본 PR 범위는 OK*. 단 후속 task 로 (1) pagination UI, (2) `users.deletedAt` (도입 시) 필터링 박제. M3 plan 의 "Validation" 섹션에 항목 추가 권장.

**[M-4] Pagination total 과 items 의 race**

- **위치**: [services/api/src/user/user.repository.ts:30-44](services/api/src/user/user.repository.ts#L30-L44)
- **문제**: `select items` 와 `select count` 가 별도 쿼리, 사이에 user 추가/삭제 시 inconsistent. UX 영향은 미미 (admin 페이지 한 번 조회의 시간 윈도우 짧음) 이지만 *원칙*으로 트랜잭션 안에서 둘 다 실행하거나 window function (`COUNT(*) OVER()`) 한 쿼리로 합치는 패턴이 더 안전.
- **본 PR 머지 차단 사유 아님** — INFO 격하 가능.

**[M-5] Tailwind raw class 사용 — mobile-ui-guide §6.2 위반**

- **위치**: [services/admin/src/features/user-invite/ui/InviteDialog.tsx](services/admin/src/features/user-invite/ui/InviteDialog.tsx), [services/admin/src/features/user-list/ui/UserListTable.tsx](services/admin/src/features/user-list/ui/UserListTable.tsx), [services/admin/src/pages/admin/users/ui/AdminUsersPage.tsx](services/admin/src/pages/admin/users/ui/AdminUsersPage.tsx), [services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx](services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx)
- **현황**: 모든 admin 신규 컴포넌트가 `bg-zinc-50/100/200/...`, `text-zinc-500/700/900/...`, `bg-white`, `dark:bg-zinc-900/950` 등 **Tailwind 기본 zinc 팔레트 + raw hex tone** 만 사용. mobile-ui-guide §6.2 는 "zinc-* 는 catalyst 잔존 사용처에서만 허용. 신규 컴포넌트는 token utility 만" 명시.
- **PR 본문의 자기 해명**: "사이드바 active 색은 `--color-accent` 대신 zinc 계열로 유지 (catalyst 잔존과의 시각 충돌 회피 — M3 완료 후 token 일괄 교체 예정)". 즉 *알면서 한 결정*이라 INFO 격하 가능하지만, **본 PR 의 코드는 사이드바뿐 아니라 모든 신규 컴포넌트가 zinc 채택** 이므로 PR 본문의 self-doc 보다 범위가 큼.
- **권장**: 후속 task ID 부여 + plan 에 박제 (`admin-zinc-to-token-migration` 같은 slug). 본 PR 머지 차단은 아님.

**[M-6] `cn()` 유틸 미사용 — mobile-ui-guide §6.3 / web/coding-style.md 위반**

- **위치**: [services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx:30](services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx#L30)
  ```tsx
  className={({ isActive }) => `${NAV_LINK_BASE_CLASS} ${isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_INACTIVE_CLASS}`}
  ```
- **권장**: `cn(NAV_LINK_BASE_CLASS, isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_INACTIVE_CLASS)`. template literal + ternary 조합은 [services/admin/CLAUDE.md](services/admin/CLAUDE.md) 의 코드 컨벤션 (services/web 와 공유) 에서 명시적으로 회피 대상. 한 줄 교체.

---

### LOW

**[L-1] `ListUsersQueryDto` default 가 DTO 가 아닌 service 에 — 일관성**

- **위치**: [services/api/src/user/user.service.ts:7-8](services/api/src/user/user.service.ts#L7-L8) (`DEFAULT_LIST_LIMIT = 50`) vs [services/api/src/admin/dto/list-users-query.dto.ts](services/api/src/admin/dto/list-users-query.dto.ts) (default 없음)
- **권장**: class-transformer 의 default 를 DTO 에서 부여 (`limit?: number = 50`). service 의 `?? DEFAULT_LIST_LIMIT` 분기 제거 가능. 단 PR 의 spec 가 "기본값 처리는 service 책임" 으로 이미 의도를 박제한 상태라 design 의도일 수도 있음 — 둘 중 하나로 통일만 명확하면 LOW.

**[L-2] clipboard 권한 거부 시 silent fail**

- **위치**: [services/admin/src/features/user-invite/ui/InviteDialog.tsx:53-61](services/admin/src/features/user-invite/ui/InviteDialog.tsx#L53-L61)
- **현황**: `try { writeText(...) } catch { setCopied(false) }` — 사용자에게 실패 통지 없음. 권한 거부 환경 (HTTPS 외 호스트, 브라우저 정책) 에서 "왜 복사가 안 됐지" 가 silent.
- **권장**: 토스트/inline 에러 추가, 또는 fallback (select+execCommand 또는 input 텍스트 선택 후 안내). 한 줄 inline 에러로 충분.

**[L-3] `<dialog>` 첫 진입 focus 명시 부재**

- **위치**: [services/admin/src/features/user-invite/ui/InviteDialog.tsx:64](services/admin/src/features/user-invite/ui/InviteDialog.tsx#L64)
- **현황**: native `<dialog>` 의 `showModal()` 이 focus trap 은 자동 처리하지만, *초기 focus 위치*는 자동 결정 — 첫 번째 tabbable 요소 (닫기 X 버튼) 가 잡힘. 사용자가 폼 작성하러 들어왔는데 첫 focus 가 X 버튼인 UX.
- **권장**: input 에 `autoFocus` 또는 `useEffect` 안에서 `inputRef.current?.focus()`.

**[L-4] roleNames 가 `@ApiProperty` 명시 없음**

- **위치**: [services/api/src/admin/dto/admin-user-list.dto.ts:7-13](services/api/src/admin/dto/admin-user-list.dto.ts#L7-L13)
- **현황**: `username`, `nickname`, `createdAt`, `roleNames` 모두 `@ApiProperty` 없음. nest swagger plugin 이 metadata.ts 로 자동 추출 (확인됨: `roleNames: { required: true, type: () => [String] }` 추출 OK) — 동작은 정상.
- **권장**: 다른 도메인 DTO 와의 일관성을 위해 명시 권장이지만, 기존 코드 (예: `UserDto`) 가 어떤 컨벤션인지 확인 후 일관성만 맞추면 OK. **삭제 가능 — 본 프로젝트는 plugin 의존 OK.**

**[L-5] `extract-public-paths.mjs` 변경이 PR scope 와 무관해 보임 (실제로는 필요)**

- 본 PR 의 핵심 변경 (admin 사용자 목록·초대) 와 별개로 method-aware 분리가 들어옴. PR 본문에 *왜* 같이 들어왔는지 (= admin endpoint 추가로 mixed-security path 가 생길 수 있어 *지금* fix 가 합리적) 한 줄 박제 권장. 단 INFO/LOW.

---

## Validation Results

| Check | Result | Note |
|---|---|---|
| Type check (api) | **FAIL** | C-1 (metadata.ts) |
| Test (api) | FAIL | 빌드 차단으로 spec 미실행 |
| Test (mq) | PASS | PR 변경 무관 |
| Test (web) | **FAIL** | H-1 (base drift, rebase 로 해결) |
| Test (admin) | PASS | admin spec 모두 통과 |
| Auto Label PR | PASS | |
| Build & Push | SKIPPED | CI 실패로 자동 SKIP |

---

## Files Reviewed

### API (services/api) — 신규/변경 14건
- A `src/admin/admin.module.ts`
- A `src/admin/user-admin.controller.ts` + `.spec.ts`
- A `src/admin/invitation-admin.controller.ts` + `.spec.ts`
- A `src/admin/dto/admin-user-list.dto.ts`, `list-users-query.dto.ts`, `index.ts`
- M `src/app.module.ts` (+ AdminModule import)
- M `src/user/user.service.ts` (+ listUsers) — **H-2 위반**
- M `src/user/user.repository.ts` (+ listUsers, AdminUserRow type)
- M `src/auth/role/role.service.ts` (+ getRoleNamesByUserIds)
- M `src/auth/role/role.repository.ts` (+ findRoleNamesByUserIds) — **M-2 (정렬)**
- M `src/metadata.ts` — **C-1 빌드 차단**
- M `src/user/{user.repository,user.service,role.service,role.repository}.spec.ts`

### Admin web (services/admin) — 신규/변경 24건
- A `src/entities/admin-user/{api/query.ts, model/types.ts, index.ts}`
- A `src/features/user-invite/{api/mutation.ts, model/useInvite.ts(+test), ui/InviteDialog.tsx(+test)}`
- A `src/features/user-list/ui/{UserListSection.tsx(+test), UserListTable.tsx(+test), UserListEmpty.tsx(+test), UserListError.tsx(+test)}`
- A `src/pages/admin/users/ui/AdminUsersPage.tsx(+test), index.ts`
- D `src/pages/admin/ui/AdminPlaceholderPage.tsx` (M2 stub 정리 — 좋음)
- M `src/app/providers/router/config.tsx` (+ /admin/users route, /admin index → redirect)
- M `src/widgets/admin-layout/ui/AdminLayout.tsx` (+ NavLink 사이드바) — **M-6**
- M `src/shared/api/generated/{sdk,types,query,public-paths}.gen.ts` (codegen 재생성)
- M `scripts/extract-public-paths.mjs` (method-aware 리팩토링) — **GOOD 보안 개선**
- M `src/shared/api/axiosInstance.ts` (isPublicPath signature 변경 반영)
- M `services/admin/CLAUDE.md`, `entities/index.ts`, `features/index.ts`, `pages/admin/index.ts`

### Docs (계획/박제) — 4건
- A `.claude/plans/admin-user-invite-list.plan.md`
- M `.claude/prds/admin-service-bootstrap.prd.md`
- A `docs/adr/0006-admin-api-prefix-and-module.md` — **잘 쓰임 (옵션 비교 + Negative 정직)**
- M `docs/adr/INDEX.md`

---

## Next Steps (제안 순서)

1. **C-1 fix (필수)** — services/api 에서 `npm run build` 로 metadata.ts 재생성 → commit.
2. **H-1 fix (필수)** — `git rebase v0.1` 또는 `git merge v0.1` → force-with-lease push. (Web CI 자동 해결.)
3. CI 재실행 후 4개 체크 (api, web, mq, admin) 모두 green 확인.
4. **H-2 결정** — DTO 위치를 옮길지 (admin/dto → user/dto), 아니면 service 시그니처를 도메인 객체로 바꿀지. 둘 중 하나를 본 PR 또는 즉시 후속 PR.
5. **H-3 결정** — 기존 `POST /invitations` 제거 vs deprecate. 본 PR scope 밖이면 후속 plan slug 신설.
6. **M-2 fix (1줄)** — role.repository.ts 의 `findRoleNamesByUserIds` 에 `.orderBy(userRoles.userId, roles.name)`.
7. **M-1 후속** — admin guard 통합 spec 1~2 건. 본 PR 머지 차단 아님, 후속 task.
8. **M-3, M-5, M-6** 는 plan 으로 후속 박제 (pagination UI, zinc → token 일괄 교체, `cn()` 통일).

---

## Strengths (긍정 평가)

- **ADR-0006 가 옵션 비교 + Negative 까지 정직하게 박제** — H-3 같은 trade-off 가 코드만 봐서는 안 보이는데 ADR 가 잡아둠.
- **`extract-public-paths.mjs` method-aware 리팩토링** — admin endpoint 추가로 mixed-security risk 가 현실화되기 직전 *선제 보안 개선*. 같은 PR 에 묶은 결정이 합리적.
- **N+1 회피 패턴** — `getRoleNamesByUserIds` batch IN 쿼리. listUsers 의 페이지 단위 N+1 차단.
- **테스트 품질** — InviteDialog spec 의 `<dialog>` polyfill, MSW, AAA 패턴 모두 잘됨. UserAdminController spec 도 "기본값은 service 책임" 같은 의미 단위 description.
- **FSD 4계층 분리** — entities → features → pages 의존 방향 깨끗. `features/user-list/` 의 UserListSection/Table/Empty/Error 책임 분리 명확.
- **a11y 기본기** — `aria-live="polite"` (로딩), `role="alert"` (에러), `<caption className="sr-only">`, NavLink 의 자동 `aria-current="page"`.

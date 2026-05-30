---
name: admin-m3-pr70-review-fix
description: PR #70 (feat/admin-m3-users-invite-list) 의 code review (.claude/reviews/pr-70-review.md) 가 박제한 CRITICAL 1 + HIGH 3 + MEDIUM 1 (M-2) 후속 — CI 빌드 차단 해소 + 모듈 경계 정상화 + endpoint 이중 노출 결정. M-1/M-3/M-5/M-6 은 별도 plan slug 로 인계.
status: done
created: 2026-05-30
completed: 2026-05-30
report: .claude/reports/admin-m3-pr70-review-fix-report.md
decisions:
  - 2026-05-30 — slug 컨벤션: `admin-m3-pr70-review-fix` (PR 번호 + review 후속). source PRD 는 admin-service-bootstrap 의 M3 row 와 동일 — 본 plan 은 그 row 의 *코드 정합성 정정 phase*.
  - 2026-05-30 — H-2 방향 결정 보류: DTO 이동(A) vs service 시그니처 변경(B) 중 어느 쪽인지 *Task 4 시작 시* 사용자 confirm. 본 plan 의 default 권장은 (A) — nestjs/coding-style.md 의 "domain DTO 는 `src/{domain}/dto/`" 컨벤션 및 ADR-0006 의 "admin 전용 service/repository 신설 금지" 와 일관.
  - 2026-05-30 — H-3 방향 결정 보류: services/web 의 `/invitations` POST 호출처 grep 결과를 *Task 5 진입 시* 사용자 confirm 한 뒤 (a) 삭제 / (b) @deprecated 분기. default 권장은 (a).
  - 2026-05-30 — H-2 채택: **옵션 (A) DTO 이동** confirmed. AdminUserList*Dto + ListUsersQueryDto → `src/user/dto/` 이동. UserService 시그니처 유지. admin controller 가 user/dto 에서 정방향 import.
  - 2026-05-30 — H-3 채택: **옵션 (a) InvitationController.create 삭제** confirmed. 사전 grep 재검증 — services/web/src + services/admin/src 의 동적 POST `/invitations` 호출자 0건. ADR-0006 status → accepted (옵션 A 완수).
---

# Plan: PR #70 review 후속 fix — CI 차단 해소 + 모듈 경계 정상화

> **Source review**: [.claude/reviews/pr-70-review.md](../reviews/pr-70-review.md)
> **Source PRD**: [.claude/prds/admin-service-bootstrap.prd.md](../prds/admin-service-bootstrap.prd.md) — M3 row 와 동일 milestone
> **Predecessor plan**: [.claude/plans/admin-user-invite-list.plan.md](./admin-user-invite-list.plan.md) (status: code-complete) — Task 1~13 의 결과물이 본 plan 의 *input*
> **Branch**: `feat/admin-m3-users-invite-list` (HEAD `b3f313e` — v0.1 보다 3 commit 앞섬)
> **Worktree**: `.worktrees/admin-m3-users-invite-list/`
> **Complexity**: Medium

## Summary

PR #70 code review 가 박제한 CRITICAL 1건 (`metadata.ts` stale twofa import — CI 빌드 차단) + HIGH 3건 (web base drift, user/admin 모듈 경계 역전, endpoint 이중 노출) + 즉시 해결 가능한 MEDIUM 1건 (M-2 orderBy 누락) 을 본 plan 으로 묶어 머지 가능 상태로 만든다. M-1 (admin guard 통합 spec) · M-3 (pagination UI) · M-5 (zinc → token) · M-6 (`cn()` 통일) · LOW 5건은 *별도 plan slug* 로 박제하고 본 plan 머지 후 진행한다.

본 plan 의 핵심 결정은 두 가지:

1. **H-2 모듈 경계** — `UserService.listUsers` 가 *user 도메인의 동작* 인데도 그 DTO 가 admin 모듈에 있어 의존성 화살표가 `admin → user → admin/dto` 로 역전. nestjs/coding-style.md 가 명시한 "domain DTO 는 `src/{domain}/dto/`" 컨벤션 + ADR-0006 의 "admin 전용 service/repository 신설 금지 (= 도메인의 자산은 도메인에)" 를 따라 DTO 를 `src/user/dto/` 로 이동.
2. **H-3 endpoint 이중 노출** — ADR-0006 옵션 A 채택 이후 `POST /invitations` (기존) + `POST /admin/users/invitations` (신규) 가 동시 노출. ADR 가 옵션 A 의 *완수* 를 강하게 시사하므로 services/web 의 호출처 부재 확인 후 기존 controller method 삭제 (옵션 a) 가 default 권장.

Task 1·2·6 (C-1 / H-1 / M-2) 은 기계적 작업. Task 3·4·5 (H-2 / H-3 결정 → 이행) 는 작업 진입 시 사용자 confirm 한 뒤 진행 — 결정이 코드 구조를 바꾸므로 무단 자동화 금지.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Domain DTO 위치 | [services/api/src/folder/dto/](../../services/api/src/folder/dto/), [services/api/src/file/dto/](../../services/api/src/file/dto/) | "domain action 의 DTO 는 해당 domain module 의 `dto/`" — nestjs/coding-style.md "도메인 모듈의 위치" 컨벤션과 일치. H-2 fix 가 이 패턴을 그대로 mirror. |
| Drizzle orderBy 패턴 | [services/api/src/folder/folder.repository.ts](../../services/api/src/folder/folder.repository.ts) — `findByUserId` 류 | `.orderBy(col1, col2)` 를 chainable builder 끝에 부착. role.repository.ts:40-46 의 `findRoleNamesByUserIds` 에 `.orderBy(userRoles.userId, roles.name)` 한 줄 추가. |
| Conventional Commits (한글 subject) | git log v0.1..HEAD — `feat(admin): M3 ...`, `feat(admin): M3 services/api ...` | `fix(api): metadata 재생성 (PR #70 review C-1)`, `refactor(api): admin DTO → user/dto 이동 (PR #70 review H-2)` 형식. |
| Test (controller + DTO 이동 회귀) | [services/api/src/admin/user-admin.controller.spec.ts](../../services/api/src/admin/user-admin.controller.spec.ts), [services/api/src/user/user.service.spec.ts](../../services/api/src/user/user.service.spec.ts) | DTO 이동 후 import path 만 갱신 — spec 의 assertion 의미 변경 없음. import 갱신 후 *전체 npm test* 로 회귀 차단. |
| 별도 plan 박제 컨벤션 | [.claude/plans/README.md](./README.md) | `{kebab-slug}.plan.md` + frontmatter `name` / `description` / `status: pending` / `created`. M-5/M-6/M-1 의 후속 plan slug 신설 시 동일 형식. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/api/src/metadata.ts` | UPDATE (재생성) | C-1: nest CLI 가 v0.1 의 23줄 minified 형식으로 자동 재생성 → admin 컨트롤러 entry 자연 포함 + stale twofa import 제거 |
| `services/api/src/auth/role/role.repository.ts` | UPDATE (한 줄) | M-2: `findRoleNamesByUserIds` 에 `.orderBy(userRoles.userId, roles.name)` 추가 — 결정성 보장 |
| `services/api/src/admin/dto/admin-user-list.dto.ts` | DELETE | H-2(A): user 도메인 DTO 가 admin 모듈에 있는 역전 해소. `src/user/dto/` 로 이동 |
| `services/api/src/admin/dto/list-users-query.dto.ts` | DELETE | 위와 동일 |
| `services/api/src/admin/dto/index.ts` | UPDATE | H-2(A): re-export 제거 또는 본 파일 전체 삭제 (admin 전용 DTO 가 없다면) |
| `services/api/src/user/dto/admin-user-list.dto.ts` | CREATE | H-2(A) destination — `AdminUserListItemDto` / `AdminUserListResponseDto` |
| `services/api/src/user/dto/list-users-query.dto.ts` | CREATE | H-2(A) destination — `ListUsersQueryDto` |
| `services/api/src/user/dto/index.ts` | CREATE 또는 UPDATE | H-2(A) re-export. 기존에 user/dto 가 없으면 CREATE |
| `services/api/src/user/user.service.ts` | UPDATE | H-2(A): import path `'../admin/dto'` → `'./dto'` 로 갱신 + service 시그니처는 동일 (default 권장 안에서) |
| `services/api/src/admin/user-admin.controller.ts` | UPDATE | H-2(A): import path `'./dto'` → `'../user/dto'` 로 갱신 |
| `services/api/src/admin/user-admin.controller.spec.ts` | UPDATE | H-2(A): mock DTO import path 갱신 |
| `services/api/src/user/user.service.spec.ts` | UPDATE | H-2(A): import path 갱신 |
| `services/api/src/invitation/invitation.controller.ts` | UPDATE (H-3 결정 시) | (a) `create` method 삭제 — 옵션 A 완수 / (b) `@ApiOperation({ deprecated: true })` + JSDoc `@deprecated` 부착 |
| `services/api/src/invitation/invitation.controller.spec.ts` | UPDATE (H-3 결정 시) | (a) spec 삭제 / (b) deprecated 검증 |
| (rebase) | — | H-1: `git rebase v0.1` 또는 `git merge v0.1`. PR diff 외 영역의 services/web trash-purge/restore 6 결함이 v0.1 의 `e4342e9` (PR #69) 에서 이미 해결됨 — 본 plan 의 코드 변경 0건, git 작업만 |
| `.claude/plans/admin-zinc-to-token-migration.plan.md` | CREATE (pending) | M-5 후속 박제 — services/admin 신규 컴포넌트의 `bg-zinc-*`/`text-zinc-*` 일괄 token utility 교체. M3 완료 후 진행 |
| `.claude/plans/admin-cn-util-rollout.plan.md` | CREATE (pending) | M-6 후속 박제 — `AdminLayout.tsx:30` 의 template literal + ternary → `cn()` 통일. M-5 와 같은 sprint 묶기 가능 |
| `.claude/plans/admin-guard-integration-spec.plan.md` | CREATE (pending) | M-1 후속 박제 — supertest 기반 PermissionGuard E2E 1~2건 추가 |
| `.claude/prds/admin-service-bootstrap.prd.md` | UPDATE | M3 row 의 plan 셀에 본 plan 경로 cross-link (admin-user-invite-list.plan.md 와 병기) |

## Tasks

### Task 1: C-1 — `metadata.ts` 재생성 (CI 빌드 차단 해소)

- **Action**:
  1. `services/api` 에서 `npm run build` 실행. nest CLI 가 `metadata.ts` 를 v0.1 의 23줄 minified 형식으로 자동 재생성. admin 컨트롤러 entry 도 자동 포함됨.
  2. `git diff services/api/src/metadata.ts` 로 변경 확인. line 수 574 → 23 줄 + stale `./twofa/*` import 0건 확인.
  3. commit: `fix(api): metadata.ts 재생성 (PR #70 review C-1 — stale twofa import 제거)`.
- **Mirror**: `services/api/src/metadata.ts` 의 v0.1 시점 형식 (23줄 minified). 본 파일은 빌드 산출물 — 직접 편집 금지.
- **Validate**:
  ```bash
  cd services/api
  npm run build              # 0 issues 확인
  npm test                   # 398/398 (또는 admin 신규 spec 포함 증가분) pass 확인
  wc -l src/metadata.ts      # 23 (또는 v0.1 동일 줄 수) 확인
  grep -c "twofa.controller" src/metadata.ts  # 0 확인
  ```

### Task 2: H-1 — base drift rebase (web CI 자동 해결)

- **Action**:
  1. 현재 worktree 의 modified files (`services/api/src/metadata.ts`) 가 Task 1 에서 commit 됐는지 확인. 미commit 분이 있으면 stash.
  2. `git fetch origin v0.1` → `git rebase origin/v0.1`.
  3. conflict 발생 시: (a) `metadata.ts` 는 본 branch 의 재생성 결과를 take (theirs/ours 결정은 conflict 발생 시 사용자 confirm). (b) `metadata.ts` 외 conflict 가 발생하면 본 plan 의 Risk 발동 — 사용자 confirm 후 결정.
  4. rebase 완료 후 `git push --force-with-lease origin feat/admin-m3-users-invite-list`.
- **Mirror**: 본 프로젝트의 git workflow — `git workflow.md` "파괴적 git 명령은 사용자 명시 요청 시에만" 정책에 따라 force-with-lease 사용 시 *사용자 confirm 필수*. plan 본문이 "force-with-lease" 를 명시했더라도 실행 직전 1회 더 confirm.
- **Validate**:
  ```bash
  git log --oneline v0.1..HEAD          # rebase 후 3 commit (또는 본 plan 의 추가 commit 포함) 확인
  cd services/web && npm run build      # trash-purge/restore 6 결함이 v0.1 의 fix 로 자동 해결됐는지 확인
  cd ../api && npm run build && npm test
  ```
  GitHub Actions CI 의 web/api/admin/mq 4 job 모두 green 확인 (Task 1+2 commit push 후).

### Task 3: H-2 결정 — DTO 위치 (admin/dto → user/dto) confirm

- **Action**:
  1. 사용자에게 H-2 default 권장 (A: DTO 이동) 을 제시. 옵션 B (service 시그니처 변경) 와 의 trade-off 한 줄로 요약:
     - **(A) DTO 이동** — 코드 이동량 작음. `UserService.listUsers` 의 시그니처 유지. admin controller 가 user/dto 에서 import (정방향).
     - **(B) Service 시그니처 변경** — `UserService.listUsers` 가 도메인 객체 `{ items, total }` 반환. DTO 조립은 `UserAdminController` 책임. service 가 DTO 를 모르게 됨 — 더 깨끗한 분리지만 controller 의 매핑 로직이 늘고 spec 도 다시 작성.
  2. 사용자 결정 → 본 plan frontmatter `decisions` 에 박제 후 Task 4 진입.
- **Validate**: 사용자 confirm 1회. plan frontmatter `decisions` line 추가.

### Task 4: H-2 이행 — DTO 이동 + import 갱신 (default 권장 시)

- **Action**:
  1. `services/api/src/user/dto/` 디렉토리 생성. `admin-user-list.dto.ts` + `list-users-query.dto.ts` 를 `git mv services/api/src/admin/dto/ → services/api/src/user/dto/` 로 이동 (git mv 로 history 보존).
  2. `services/api/src/user/dto/index.ts` 생성 — `AdminUserListItemDto`, `AdminUserListResponseDto`, `ListUsersQueryDto` re-export.
  3. `services/api/src/admin/dto/index.ts` — admin 전용 DTO 가 없으면 본 파일 삭제, 있으면 user/dto 의 re-export 제거.
  4. import path 갱신 (sed/IDE refactor):
     - `services/api/src/user/user.service.ts` — `from '../admin/dto'` → `from './dto'`
     - `services/api/src/admin/user-admin.controller.ts` — `from './dto'` → `from '../user/dto'`
     - 각 spec 파일 import path 갱신
  5. commit: `refactor(api): admin DTO → user/dto 이동 (PR #70 review H-2 — 모듈 경계 정방향화)`.
- **Mirror**: `services/api/src/folder/dto/`, `services/api/src/file/dto/` — domain action 의 DTO 가 해당 domain module 내부에 위치하는 패턴.
- **Validate**:
  ```bash
  cd services/api
  npm run build                                    # tsc 0 errors
  npm test                                         # 398/398 (또는 동일 분량) pass
  grep -rn "from.*admin/dto" src                   # 0 hit
  grep -rn "from.*user/dto" src/admin              # ≥1 hit (controller import)
  ```

### Task 5: H-3 결정 + 이행 — endpoint 이중 노출 정리

- **Action**:
  1. **사전 grep 결과 (본 plan 작성 시 1회 수행 완료, 2026-05-30)**:
     ```text
     services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx (3 hit)
       → 모두 GET /api/invitations/:token (validate endpoint) MSW mock — POST 호출처 아님
     services/web/src/shared/api/generated/{sdk,types,public-paths}.gen.ts (6 hit)
       → 모두 codegen 산출물 (POST /invitations 의 타입 표면). 동적 호출 코드 0건
     services/admin/src                  0 hit
     ```
     **결론**: POST `/invitations` 의 *동적 호출* (`useMutation({ mutationFn })`, `mutationFn` 직접 호출) 0건. 옵션 (a) 채택 안전 — controller method 제거 후 services/web codegen 재실행 시 sdk.gen.ts/types.gen.ts 의 표면 자동 정리.
  2. 사용자에게 grep 결과 + 옵션 (a)/(b) 채택 confirm (default 권장 a):
  2. 사용자에게 grep 결과 + 옵션 (a)/(b) trade-off 제시:
     - **(a) 삭제** — `InvitationController.create` method 제거. spec 도 삭제. ADR-0006 옵션 A 완수.
     - **(b) @deprecated 마킹** — controller method 유지 + `@ApiOperation({ deprecated: true })` + JSDoc `@deprecated` + 후속 plan 일정 박제.
  3. 사용자 결정 → 본 plan frontmatter `decisions` 박제.
  4. 결정 따라 이행:
     - (a) `InvitationController.create` + spec 삭제. `services/api/src/invitation/invitation.controller.ts` 의 line 13-19 + `invitation.controller.spec.ts` 의 해당 describe 블록 제거.
     - (b) `@ApiOperation({ summary: '초대장 생성 (deprecated — 신규 호출은 POST /admin/users/invitations)', deprecated: true })` 부착 + JSDoc `@deprecated` + 본 plan frontmatter 에 "후속 plan slug 신설" 박제.
  5. ADR-0006 의 status 갱신 — `proposed` → `accepted` (옵션 A 완수의 경우) 또는 status 유지 + Consequences 에 endpoint 이중 노출 한시 허용 박제 (옵션 b 의 경우).
  6. commit:
     - (a) `refactor(api): POST /invitations 제거 — ADR-0006 옵션 A 완수 (PR #70 review H-3)`
     - (b) `chore(api): POST /invitations @deprecated 마킹 (PR #70 review H-3)`
- **Mirror**: ADR-0006 의 Decision 섹션 — "controller 는 admin 정책만 담당, 핵심 로직은 도메인 service 위임". 옵션 A 의 *완수* 가 ADR 의 자연 귀결.
- **Validate**:
  ```bash
  cd services/api
  npm run build && npm test
  # 옵션 (a) 의 경우
  grep -n "@Post()" src/invitation/invitation.controller.ts  # 0 hit (create method 가 사라졌으므로)
  npm run start:dev &
  curl -s http://localhost:3000/json | jq '.paths | keys | map(select(. == "/invitations"))'
  # 결과: [] (옵션 a) 또는 ["/invitations"] + paths."/invitations".post.deprecated == true (옵션 b)
  ```

### Task 6: M-2 — `findRoleNamesByUserIds` orderBy 추가

- **Action**:
  1. [services/api/src/auth/role/role.repository.ts:40-46](../../services/api/src/auth/role/role.repository.ts#L40-L46) 의 `findRoleNamesByUserIds` 의 builder chain 끝에 `.orderBy(userRoles.userId, roles.name)` 추가.
  2. `drizzle-orm` 의 `asc` import 가 필요한지 확인 (대부분 `.orderBy(col)` default 가 asc — 본 프로젝트 기존 사용처 grep 으로 확인).
  3. 기존 `role.repository.spec.ts` 의 `findRoleNamesByUserIds` 케이스에 *정렬 결정성 verification* 추가 — 동일 userId 의 role 이 항상 `name` asc 순서로 반환되는지 assertion 보강. AAA 패턴 유지.
  4. commit: `fix(api): role 이름 batch 결과 결정성 정렬 (PR #70 review M-2)`.
- **Mirror**: drizzle `.orderBy()` 사용처 — `services/api/src/folder/folder.repository.ts` 의 listing 류 method.
- **Validate**:
  ```bash
  cd services/api
  npm test -- role.repository.spec
  npm run build
  ```

### Task 7: 후속 plan slug 박제 (M-1 / M-3 / M-5 / M-6)

- **Action**: 본 plan 머지 차단은 아니지만 review 의 추적성을 위해 *pending plan slug* 3~4건을 신설:
  1. `.claude/plans/admin-guard-integration-spec.plan.md` — M-1: supertest E2E + `Test.createTestingModule` 기반 PermissionGuard 통합 spec 1~2건.
  2. `.claude/plans/admin-zinc-to-token-migration.plan.md` — M-5: services/admin 신규 컴포넌트의 `bg-zinc-*`/`text-zinc-*`/`dark:bg-zinc-*` 일괄 token utility 교체. 본 plan 에서 변경하지 않는다 (mobile-ui-guide §6.2 catalyst 잔존 정책 한시 허용).
  3. `.claude/plans/admin-cn-util-rollout.plan.md` — M-6: `AdminLayout.tsx:30` template literal + ternary → `cn()` 통일. M-5 와 같은 sprint 묶기 권장 (둘 다 services/admin 동일 컴포넌트 surface).
  4. (선택) `.claude/plans/admin-users-pagination.plan.md` — M-3: pagination UI + `users.deletedAt` 도입 시 soft-delete 필터링 박제.
  - 각 plan 은 frontmatter 만 작성 — `name`, `description` 한 줄, `status: pending`, `created`, `decisions: []`. 본문은 README 의 슬림 박제 (Summary 2 sentences + Tasks "TBD on activation").
- **Validate**:
  ```bash
  ls .claude/plans/admin-*.plan.md      # 본 plan + 후속 3~4건 확인
  ```

### Task 8: PRD M3 row 갱신 + ADR-0006 status 동기화

- **Action**:
  1. `.claude/prds/admin-service-bootstrap.prd.md` 의 M3 row 의 plan 셀에 본 plan 경로를 cross-link (기존 `admin-user-invite-list.plan.md` 와 병기 — 두 plan 이 같은 milestone 의 2 phase 임을 명시).
  2. ADR-0006 의 `Status` 갱신:
     - H-3 옵션 (a) 채택 시: `proposed — 2026-05-29` → `accepted — 2026-05-30 (옵션 A 완수)`
     - H-3 옵션 (b) 채택 시: status 유지 + Consequences 의 Negative 섹션에 "POST /invitations 한시 deprecated 잔존 — 후속 plan: admin-invitation-legacy-removal.plan.md" 박제.
  3. ADR-0006 의 `References` 의 "구현 PR: feat/admin-m3-users-invite-list (TBD ...)" 를 *실제 PR 번호 + 본 plan 경로* 로 갱신.
  4. commit: `docs(adr): ADR-0006 status 갱신 + PRD M3 plan cross-link (PR #70 review followup)`.
- **Validate**:
  ```bash
  grep -n "admin-m3-pr70-review-fix" .claude/prds/admin-service-bootstrap.prd.md
  grep -n "accepted\|deprecated" docs/adr/0006-admin-api-prefix-and-module.md
  ```

## Validation

본 plan 머지 가능 상태 acceptance — 아래 모든 check pass.

```bash
# (1) services/api 모든 spec + build (Task 1·4·5·6 결과)
cd c:/_project/my/terab/.worktrees/admin-m3-users-invite-list/services/api
npm run lint        # 0 errors
npm test            # ≥398/398 pass (admin spec + listUsers spec 포함)
npm run build       # 0 issues

# (2) metadata.ts 형식 확인 (Task 1)
wc -l src/metadata.ts                       # 23 line (v0.1 형식) 확인
grep -c "twofa.controller" src/metadata.ts  # 0

# (3) DTO 이동 회귀 (Task 4)
grep -rn "from.*['\"].*admin/dto" src        # 0 hit (모든 import 가 user/dto 로 이동)
ls src/user/dto/                             # admin-user-list.dto.ts, list-users-query.dto.ts, index.ts

# (4) endpoint 이중 노출 정리 (Task 5)
# 옵션 (a) 의 경우
grep -n "@Post()" src/invitation/invitation.controller.ts  # 0 hit
# 옵션 (b) 의 경우
grep -n "deprecated: true" src/invitation/invitation.controller.ts  # ≥1 hit
# 공통: swagger 노출 확인 (dev infra 가동 필요)
npm run start:dev &
curl -s http://localhost:3000/json | jq '.paths | to_entries[] | select(.key | test("invitation"))'

# (5) orderBy 결정성 (Task 6)
npm test -- role.repository.spec

# (6) services/web base drift 자동 해결 (Task 2)
cd ../web && npm run build                 # 0 errors (trash-purge/restore 6 결함이 v0.1 의 PR #69 fix 로 해결)

# (7) services/admin 회귀 (PR #70 머지 가능 상태 재확인)
cd ../admin && npm run lint && npm test && npm run build

# (8) GitHub Actions CI 4 job (api/mq/web/admin) 모두 green 확인
# Build & Push 워크플로 SKIP → 정상 실행 전환
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `npm run build` 가 metadata.ts 외 파일도 자동 생성/수정 (예: `.tsbuildinfo`) → diff 가 예상보다 큼 | Medium | Task 1 의 commit scope 를 `src/metadata.ts` 만으로 제한 (`git add services/api/src/metadata.ts`). `.tsbuildinfo` 류는 .gitignore 확인. |
| `git rebase v0.1` 에서 metadata.ts 외 파일 conflict 발생 (예: app.module.ts 의 AdminModule import 위치) | Low | Task 2 에서 conflict 발생 시 즉시 사용자 confirm. base 가 `8938dc0` 인데 v0.1 최신은 `e4342e9` 까지 — 본 PR 의 신규 파일들(`src/admin/*`)은 *base 에 없던 신규* 라 conflict 위험 낮음. 만약 `app.module.ts` 에서 #69 (trash) 와 충돌 시 v0.1 쪽 trash import 유지 + admin import 본 PR 쪽 유지. |
| H-2 옵션 (B) (service 시그니처 변경) 채택 시 spec rewrite 분량이 default 권장 (옵션 A) 보다 커짐 | Low (default 가 A) | Task 3 의 confirm 시 분량 차이 명시. plan 의 Files-to-Change 표가 옵션 A 기준이므로 옵션 B 채택 시 본 plan 의 Task 4 를 *재작성* 한 뒤 진행. |
| H-3 옵션 (a) 채택했는데 services/web 에 `/invitations` POST 호출이 *런타임 동적 path* 로 숨어 있어 grep 누락 | Medium | Task 5 의 사전 grep 에 추가로 `useMutation\({.*invitations` / `mutationFn.*invitations` 패턴도 grep. 또한 services/web 의 invitation 관련 hook 디렉토리 (`features/invitation*/`) 전수 read 1회. 옵션 (b) (@deprecated) 가 호출처 발견 시 fallback path. |
| ADR-0006 status 갱신이 사용자 결정 보류로 본 plan 머지 차단 | Low | Task 8 의 ADR 갱신은 *H-3 결정 commit 과 같은 commit 에 묶지 않는다*. 별도 commit 으로 분리해 H-3 결정만 먼저 머지 가능. |
| 후속 plan slug 신설 (Task 7) 이 plan 디렉토리 noise 증가 | Low | 각 slug 의 frontmatter `status: pending` + Summary 2 sentences 만으로 슬림 유지. README 의 archive 정책 (30일 후 archive) 으로 정리 |
| `.claude/reviews/` 디렉토리가 git 추적 대상인지 확인 안 됨 — review 파일 자체의 PR 동반 commit 정책 미정 | Low | 본 plan 머지 차단 아님. `.gitignore` 확인 후 review 파일을 함께 commit 할지 별도 commit 분리할지 결정. |

## Acceptance

- [ ] **Task 1 (C-1)** — `services/api/src/metadata.ts` 가 v0.1 의 minified 형식으로 재생성됐고, `npm run build` 가 0 issue.
- [ ] **Task 2 (H-1)** — `git rebase v0.1` 완료 + force-with-lease push + web CI green.
- [ ] **Task 3 (H-2 결정)** — DTO 이동 (A) vs service 시그니처 (B) 중 사용자 결정 박제.
- [ ] **Task 4 (H-2 이행)** — Task 3 결정에 따라 코드 변경 + 모든 spec pass.
- [ ] **Task 5 (H-3 결정 + 이행)** — services/web `/invitations` POST 호출처 grep 결과 박제 + 옵션 (a)/(b) 결정 + 코드 변경.
- [ ] **Task 6 (M-2)** — `.orderBy(userRoles.userId, roles.name)` 추가 + spec 결정성 verification.
- [ ] **Task 7** — 후속 plan slug 3~4건 frontmatter pending 박제.
- [ ] **Task 8** — PRD M3 row 갱신 + ADR-0006 status 동기화.
- [ ] **CI 4 job (api / mq / web / admin) 모두 green**.
- [ ] **Build & Push 워크플로 SKIP 해소** → 정상 실행 전환.
- [ ] **PR #70 의 머지 차단 사유 (review 의 Validation Results 표) 가 모두 PASS 로 전환**.
- [ ] **본 plan frontmatter `status: in-progress` → `done`** 머지 시점에 갱신.

> **다음 단계**: 본 plan 의 task 별 TDD/검증 loop 는 `/ecc:prp-implement .claude/plans/admin-m3-pr70-review-fix.plan.md` 로 진입한다. 단, Task 3/5 는 사용자 결정 step 이 있어 prp-implement 도중 *명시적 confirm pause* 가 발생한다.

# 구현 보고서: PR #70 review 후속 fix — CI 차단 해소 + 모듈 경계 정상화

- **Plan**: `.claude/plans/admin-m3-pr70-review-fix.plan.md` → `.claude/plans/completed/` 로 archive
- **Source review**: `.claude/reviews/pr-70-review.md`
- **Branch**: `feat/admin-m3-users-invite-list` (rebased onto `v0.1`)
- **Head**: `84c0294` (9 commit ahead of `v0.1`, force-with-lease pushed)
- **사용자 결정 (Task 3 / 5)**:
  - **H-2**: 옵션 (A) — DTO 이동 (`admin/dto` → `user/dto`)
  - **H-3**: 옵션 (a) — `InvitationController.create` 삭제 (ADR-0006 옵션 A 완수)

## 요약

PR #70 code review 가 박제한 **CRITICAL 1 + HIGH 3 + MEDIUM 1** 을 본 plan 으로 묶어 머지 가능 상태로 만들었다. 핵심은:

1. **C-1** — `metadata.ts` 의 stale `TwoFaController` import 가 CI API 빌드를 차단 (TS2307). nest CLI 의 swagger plugin 으로 v0.1 의 23줄 minified 형식 재생성.
2. **H-1** — base drift (`8938dc0` → `e4342e9`) 로 web CI 의 trash-purge/restore 6 결함 + storage Phase 3 등이 흡수 안 됨. `v0.1` 에 rebase 후 force-with-lease push 로 *PR 코드 변경 0건* 으로 자동 해소.
3. **H-2** — `UserService.listUsers` 가 user 도메인 동작인데 그 DTO 가 admin 모듈에 있어 의존성 화살표 역전. `git mv` 로 `admin/dto/` 전체를 `user/dto/` 로 이동, admin controller 가 user/dto 에서 정방향 import.
4. **H-3** — ADR-0006 옵션 A 채택 이후 `POST /invitations` + `POST /admin/users/invitations` 동시 노출. services/web 의 동적 POST 호출자 0건 재검증 후 `InvitationController.create` 메서드 + 관련 spec describe 블록 제거. ADR-0006 status `proposed → accepted` 동기화.
5. **M-2** — `findRoleNamesByUserIds` 의 SQL 에 `.orderBy(userRoles.userId, roles.name)` 추가. 결정성 verification 도 spec 에 보강.

후속 review 항목 4건(M-1 / M-3 / M-5 / M-6)은 별도 plan slug 로 박제. LOW 5건은 본 plan scope 외.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| 머지 차단 결함 해소 | C-1 + H-1~H-3 + M-2 (5건) | 5건 모두 해소 |
| 신규 commit 수 | 6~8 | 6 (C-1, M-2, H-2, H-3, ADR/PRD docs, plan stubs) |
| Files Changed (코드) | ~9 (api) | 13 (api) — DTO 이동 4 + rename + import 갱신 + spec |
| Files Changed (docs) | 5 (plan + ADR + PRD + 후속 plan 4) | 7 (plan 5 신설/갱신 + review 박제 + ADR + ADR INDEX + PRD) |
| 후속 plan slug 박제 | 3~4건 | 4건 (M-1, M-3, M-5, M-6) |
| Rebase conflict | 1 (`app.module.ts`) | 1 (예측 일치 — `AdminModule` vs `DriveModule`/`MountCredentialModule` imports 배열) |

## Tasks Completed

| # | Task | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | C-1 — `metadata.ts` 재생성 | ✅ Complete | `28e66f9` | surgical (stale TwoFa entry 제거) → nest build 의 swagger plugin 이 23줄 minified 재생성. v0.1 형식과 일치. |
| 2 | H-1 — `v0.1` rebase + force-with-lease push | ✅ Complete | (rebase, no commit) | 9 commit 중 1 conflict (`app.module.ts`). resolution: `AdminModule + DriveModule + MountCredentialModule` 모두 유지. |
| 3 | H-2 결정 — 옵션 (A) DTO 이동 confirm | ✅ Complete | (plan frontmatter) | |
| 4 | H-2 이행 — `admin/dto → user/dto` 이동 + import 갱신 | ✅ Complete | `8d3a84e` | `git mv` 로 history 100% 보존. metadata.ts 의 stale path 도 함께 갱신. |
| 5 | H-3 — `InvitationController.create` 삭제 | ✅ Complete | `598d08e` | 사전 grep 재검증 (web/admin 동적 호출자 0건). unused imports + spec describe 블록 제거. |
| 6 | M-2 — `findRoleNamesByUserIds.orderBy` 추가 | ✅ Complete | `5722830` | spec 의 chain mock 갱신 + 결정성 verification 1건 추가. |
| 7 | 후속 plan slug 4건 박제 | ✅ Complete | `84c0294` | M-1 (guard E2E), M-3 (pagination), M-5 (zinc→token), M-6 (cn 통일). 본 plan + review 도 함께 박제. |
| 8 | PRD M3 cross-link + ADR-0006 status 갱신 | ✅ Complete | `5fe1c08` | ADR `proposed → accepted` (옵션 A 완수). PRD M3 row 에 본 plan 경로 cross-link. ADR INDEX 도 동기화. |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| services/api lint/build/test | ✅ Pass | 458/458 tests · 77 suites · 0 build issue (306 files compiled by swc). rebase 후 v0.1 의 PR #72/#75/#76 spec 들도 흡수해 +60. |
| services/web build | ✅ Pass | rebase 후 `npm install` 필수 (v0.1 의 `vitest-axe` + `class-variance-authority` 신규 의존성). |
| services/web test | ⚠️ 1 flaky | `useFileSearch.test.tsx` 의 debounce timing spec 1건 flaky — 재실행 시 9/9 통과. **본 PR scope 외** (v0.1 PR #72 file-search 슬라이스의 기존 flaky). |
| services/admin build/test | ✅ Pass | 64/64 tests · 15 files. |
| services/mq build/test | ✅ Pass | 4/4 tests. |

> GitHub Actions CI 의 4 job 재실행은 force-with-lease push 후 자동 트리거. Build & Push 워크플로 SKIP 해소 예상.

## Files Changed (요약)

| 영역 | Action | 비고 |
|---|---|---|
| `services/api/src/metadata.ts` | UPDATE × 3 | 매 코드 변경 후 swagger plugin 으로 자동 재생성 (C-1, H-2, H-3). |
| `services/api/src/admin/dto/*` → `services/api/src/user/dto/*` | RENAME × 3 (100%) | H-2 — git history 보존 이동. `admin/dto` 디렉토리 자체 제거. |
| `services/api/src/admin/user-admin.controller.ts` | UPDATE | H-2 — DTO import path 갱신. |
| `services/api/src/user/user.service.ts` | UPDATE | H-2 — `from '../admin/dto'` → `from './dto'`. |
| `services/api/src/invitation/invitation.controller.ts` | UPDATE | H-3 — `create` 메서드 + unused imports 제거. |
| `services/api/src/invitation/invitation.controller.spec.ts` | UPDATE | H-3 — `describe('create')` 블록 + unused mock 제거. |
| `services/api/src/auth/role/role.repository.ts` | UPDATE | M-2 — `.orderBy(userRoles.userId, roles.name)`. |
| `services/api/src/auth/role/role.repository.spec.ts` | UPDATE | M-2 — chain mock 갱신 + 결정성 verification 1건. |
| `services/api/src/app.module.ts` | UPDATE | rebase conflict resolution — admin + drive + mount-credential 세 module 모두 유지. |
| `docs/adr/0006-admin-api-prefix-and-module.md` | UPDATE | status `proposed → accepted`, references 갱신. |
| `docs/adr/INDEX.md` | UPDATE | 0006 row status/date 동기화. |
| `.claude/prds/admin-service-bootstrap.prd.md` | UPDATE | M3 row 에 본 plan 경로 cross-link. |
| `.claude/plans/admin-m3-pr70-review-fix.plan.md` | CREATE | 본 plan. frontmatter status `pending → in-progress → done`. |
| `.claude/plans/admin-{guard-integration-spec,users-pagination,zinc-to-token-migration,cn-util-rollout}.plan.md` | CREATE × 4 | M-1/M-3/M-5/M-6 후속 plan slug 박제. |
| `.claude/reviews/pr-70-review.md` | CREATE | review 본문 박제 (후속 plan slug 의 source). |

## Deviations from Plan

| 항목 | Plan 예상 | 실제 | 사유 |
|---|---|---|---|
| Task 1 절차 | `npm run build` → metadata.ts 자동 재생성 (정공법) | surgical fix (stale TwoFa entry 제거) → `npm run build` → 재생성 | nest CLI 빌드 파이프라인이 *TSC type check → swagger plugin*. type check 가 stale import 에서 막혀 plugin 에 도달 못 함 — 1줄 surgical 이 전처리로 필요. |
| Task 4 절차 | DTO 이동 → build | DTO 이동 → metadata.ts 의 stale path 일괄 치환 → build | Task 1 과 동일 이유 — metadata.ts 가 옛 경로를 참조해 type check 차단. sed 한 줄 추가. |
| Task 순서 | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 | 1 → 6 → 3 → 4 → 5 → 8 → 7 → 2 | 작은 변경(M-2) 을 먼저 처리해 회귀 가능성 낮춤. rebase(Task 2)를 마지막에 두어 plan 박제(Task 7) commit 도 함께 force push. |
| 후속 plan slug | 3~4건 | 4건 모두 박제 (선택 사항이던 M-3 도 포함) | review 의 모든 MEDIUM 항목을 1:1 매핑해 추적성 보강. |

## Issues Encountered

| 이슈 | 해결 |
|---|---|
| nest build 가 stale metadata.ts 의 type error 에서 멈춰 swagger plugin 재생성에 도달 못 함 | surgical fix (TwoFa entry 제거 / DTO path 치환) 를 전처리로 적용 후 build. plan 본문의 "정공법" 은 *전처리 후* 의 정공법으로 보강 — 본 보고서 Deviations 에 박제. |
| rebase 후 services/web 빌드 실패 (`vitest-axe`, `class-variance-authority` 미해소) | v0.1 의 PR #73/#75 가 추가한 신규 npm 의존성 — `npm install` 로 해결. *rebase 후엔 항상 install* 가 시사점. |
| services/web 의 `useFileSearch.test.tsx` 1건 flaky | debounce timing 기반 — 재실행 시 통과. PR scope 외 + v0.1 base 자체의 flaky. 머지 차단 사유 아님. |

## Spec Coverage

| Test File | Tests | Coverage |
|---|---|---|
| `services/api/src/auth/role/role.repository.spec.ts` | +1 (3 → 4) | M-2 결정성 — `.orderBy` 호출 verification |
| `services/api/src/invitation/invitation.controller.spec.ts` | −2 (5 → 3) | `create` describe 블록 제거 — controller 변경에 따른 자연 감소 |

## 후속 작업 (별도 plan)

| Slug | review 항목 | 상태 |
|---|---|---|
| [admin-guard-integration-spec](../plans/admin-guard-integration-spec.plan.md) | M-1 — admin endpoint PermissionGuard 통합 spec | pending |
| [admin-users-pagination](../plans/admin-users-pagination.plan.md) | M-3 — pagination UI + soft-delete 필터링 | pending |
| [admin-zinc-to-token-migration](../plans/admin-zinc-to-token-migration.plan.md) | M-5 — services/admin zinc → token utility 일괄 교체 | pending |
| [admin-cn-util-rollout](../plans/admin-cn-util-rollout.plan.md) | M-6 — AdminLayout NavLink `cn()` 통일 | pending |

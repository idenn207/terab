---
name: admin-user-invite-list
description: services/admin 의 A-05 사용자 초대 + A-03 사용자 목록 — services/api 의 `/admin/*` 모듈 + admin frontend 의 invite/list FSD 슬라이스 + NAS 배포 + 본인 e2e (1명 초대 → 가입 → 로그인 → 목록 표시)
status: code-complete
created: 2026-05-29
decisions:
  - 2026-05-29 — endpoint 정책: 옵션 A 채택. `services/api/src/admin/` 신규 도메인 모듈 + `POST /admin/users/invitations` + `GET /admin/users`. 핵심 로직은 InvitationService/UserService 위임. ADR-0006 으로 박제.
  - 2026-05-29 — AdminPlaceholderPage 처리: 삭제 확정. `/admin` index 는 `<Navigate to="/admin/users" replace>` 로 교체.
  - 2026-05-29 — worktree 복원: 세션 도중 `.worktrees/admin-service-bootstrap` 워크트리가 detach 됨. 새 워크트리 `.worktrees/admin-m3-users-invite-list` (브랜치 `feat/admin-m3-users-invite-list`, base v0.1@d22a060) 로 이관. ADR 번호는 storage-agent PR #63 가 0005 점유로 `0006-admin-api-prefix-and-module.md` 로 renumber.
---

# Plan: A-05 사용자 초대 + A-03 사용자 목록 (services/admin M3)

> **NOTE — 세션 복구 (2026-05-29)**: 본 plan 의 원본은 detach 된 worktree 의 `.claude/plans/admin-user-invite-list.plan.md` 에 있었으나 worktree partial-remove 로 소실. 본 파일은 그 시점의 Task 결정·검증 기준·Risks·Acceptance 를 *세션 conversation 기록* 으로부터 회복한 slim 버전. 코드 산출물(Task 1~6 완료분) 은 새 워크트리로 정상 이관되어 build + npm test 통과(398/398). 원본의 상세 표·Mirror reference 가 필요하면 본 세션의 conversation transcript 를 참조한다.

**Source PRD**: [.claude/prds/admin-service-bootstrap.prd.md](../prds/admin-service-bootstrap.prd.md)
**Selected Milestone**: M3 — A-05 사용자 초대 + A-03 사용자 목록 동작
**Branch**: `feat/admin-m3-users-invite-list` (base v0.1@d22a060)
**Worktree**: `.worktrees/admin-m3-users-invite-list/`

## Summary

M3 는 PRD 의 가설 — "본인이 브라우저에서 사용자 1명을 초대 → 가입 → 첫 로그인" — 을 실제로 가능하게 만든다. 세 surface 동시 변경:

1. **services/api** — `src/admin/` 신규 도메인 모듈 + `POST /admin/users/invitations` + `GET /admin/users`. 컨트롤러는 권한 게이트 + DTO 래퍼만, 로직은 기존 `InvitationService` + 신규 `UserService.listUsers` 위임. ([ADR-0006](../../docs/adr/0006-admin-api-prefix-and-module.md))
2. **services/admin** — M2 인프라(axios + hey-api + AdminGate + AdminLayout) 위에 `features/user-invite/`, `features/user-list/`, `pages/admin/users/` FSD 슬라이스 추가. AdminLayout 사이드바 "사용자" 메뉴 활성화.
3. **NAS 배포 + e2e** — admin.drive.skypark207.com 첫 운영 배포 + 본인 admin → invite 발급 → 다른 브라우저 회원가입 → admin 목록 새로 표시 4단계 통과.

기존 `/invitations` controller 는 비편집 (services/web 회원가입 흐름 의존 + 회귀 risk 회피).

## Tasks (요약)

| # | Task | 상태 | 검증 |
|---|---|---|---|
| 1 | services/api — AdminModule 스켈레톤 + AppModule 등록 + Invitation/UserModule export 검증 | done | build pass |
| 2 | ListUsersQueryDto + AdminUserListItemDto/ResponseDto | done | build pass |
| 3 | UserService.listUsers + UserRepository.listUsers + RoleService.getRoleNamesByUserIds batch (TDD) | done | spec pass (RED → GREEN) |
| 4 | UserAdminController GET /admin/users (TDD) | done | spec pass |
| 5 | InvitationAdminController POST /admin/users/invitations (TDD) | done | spec pass |
| 6 | services/api 통합 sanity (전체 spec + build + lint) | done | 398/398 spec pass, build pass, lint clean |
| 7a | extract-public-paths.mjs method-aware 재설계 + axiosInstance 인터셉터 갱신 | done | tsc pass, axiosInstance 5 tests pass |
| 7b | services/admin generated 수동 갱신(admin endpoint) + entities/admin-user 슬라이스 — 정식 codegen 은 NAS 배포 직전 사용자 1회 | done (수동) | tsc pass, build pass |
| 8 | services/admin features/user-list (UserListSection + Table/Empty/Error + tests) | done | 12 tests pass |
| 9 | services/admin features/user-invite (RHF + useInvite + InviteDialog + tests) | done | 9 tests pass |
| 10 | pages/admin/users + router 갱신 + AdminLayout 사이드바 활성화 + AdminPlaceholderPage 삭제 | done | tsc pass, /admin index → /admin/users redirect |
| 11 | NAS 배포 (DSM 라우팅 + admin.prod.env + master merge) | pending — 사용자 인계 | docker service ls + curl admin.drive.skypark207.com 200 |
| 12 | e2e 본인 1명 초대 → 가입 → 로그인 → 목록 표시 | pending — 사용자 인계 | 4단계 시각 확인 통과 |
| 13 | services/admin/CLAUDE.md + PRD M3 row 갱신 (ADR-0006 status 는 PR 머지 후 별도 commit) | done (CLAUDE.md + PRD) / pending (ADR) | grep 확인 |

> Task 1~6 의 상세 작성물:
> - `services/api/src/admin/` — admin.module.ts, invitation-admin.controller.ts + .spec.ts, user-admin.controller.ts + .spec.ts, dto/admin-user-list.dto.ts, dto/list-users-query.dto.ts, dto/index.ts (8 files)
> - `services/api/src/{user,auth/role}/{repository,service}.ts + .spec.ts` — listUsers / getRoleNamesByUserIds batch 추가
> - `services/api/src/app.module.ts` — AdminModule import + 등록

## Validation

```bash
# (1) services/api 단위 + 통합 (Task 1~6 완료 확인)
cd c:/_project/my/terab/.worktrees/admin-m3-users-invite-list/services/api
npm run lint        # 0 errors
npm test            # 398/398 (current) — 신규 admin spec 4건 + listUsers spec 7건 포함
npm run build       # 0 issues, 282 files

# (2) swagger 검증 (dev API 가동 + DB/Redis infra 필요)
npm run start:dev
curl -s http://localhost:3000/json | jq '.paths | keys | map(select(startswith("/admin")))'
# → ["/admin/users", "/admin/users/invitations"]

# (3) services/admin (Task 7~10 pending)
cd ../admin
npm ci                                     # node_modules 설치 (필요 시)
npm run openapi:codegen                    # /invitations/{token} mixed-security 결함 사전 해결 필요
npm run build                              # bundle < 300kb gzipped

# (4) NAS 배포 후 (Task 11 pending)
curl -I https://admin.drive.skypark207.com/                                # 200
curl -I https://admin.drive.skypark207.com/api/admin/users                 # 401 (no token)
curl -I https://drive.skypark207.com/                                      # 200 회귀 없음

# (5) e2e 본인 시나리오 (Task 12 pending)
# - admin 로그인 → /admin/users 진입 → invite 발급 → URL 복사
# - services/web 의 /register/<token> 로 가입 → 로그인 가능
# - admin 목록 새로고침 → 새 사용자 표시
```

## Risks (현 시점 활성)

| Risk | Mitigation |
|---|---|
| `extract-public-paths.mjs` 가 `/invitations/{token}` mixed-security (GET=public + DELETE=admin) 로 빌드 실패 — pre-existing, M3 범위 외 | (a) 스크립트를 method-aware 로 재설계 (path → `{path, method}` 단위) (b) invitation.controller 의 GET/DELETE path 분리 둘 중 하나. 본 plan 의 Task 7 진입 전 별도 commit 으로 처리 권장 |
| `InvitationService.create` 의 `APP_BASE_URL` 이 NAS prod 환경에서 `https://drive.skypark207.com` 으로 설정 안 되면 invite URL 오류 | Task 11 사전 점검에 `api.prod.env` 확인 명시 |
| services/web `/register/<token>` 가 backup code / 2FA 등록을 처리하지 못해 새 사용자 admin 진입 차단 | PRD risk 동일. 본 plan scope 외 — 별도 PRD 분기 후속 |
| `npm run openapi:codegen` 이 dev API 미가동 시 실패 (`http://localhost:3000/json` fetch 실패) | Task 7 사전 단계로 `make api` 또는 `make infra && cd services/api && npm run start:dev` 가동 명시 |
| NAS DSM 라우팅 / TLS 인증서 / prod env 첫 세팅 시 시간 소요 | M1 plan Task 8 시나리오 재사용 — DSM Application Portal 에 admin.drive.skypark207.com 추가 + `/volume3/docker/terab/admin.prod.env` 생성 |

## Acceptance

- [x] Task 1~6 의 각 검증 통과 (services/api side 완료, 398/398 spec, build/lint clean)
- [x] Task 7~10 (services/admin side) 완료 + build/test/번들사이즈 통과 (64 vitest pass, build 159kb gzipped — app page 300kb budget 안)
- [ ] Task 11 NAS 배포 후 admin.drive.skypark207.com 200, /admin/users 401 (no token), drive.skypark207.com 회귀 없음 — **사용자 인계**
- [ ] Task 12 e2e 4단계 시각 통과 — **사용자 인계**
- [x] PRD M3+M4 row done 갱신 (M3/M4 통합 진행, code complete)
- [ ] ADR-0006 status accepted 로 갱신 — **PR 머지 후 별도 commit (ADR-0005 패턴)**
- [x] PR diff 에 services/web 0줄 수정 (확인: services/web 디렉토리 수정 없음)
- [x] 모든 변경이 worktree `.worktrees/admin-m3-users-invite-list/` 안 ([CLAUDE.md worktree 정책](../../CLAUDE.md))

## Implementation Notes

### 사전 결함 해결 (Task 7a)

plan 의 Risk #1 — `extract-public-paths.mjs` 가 `/invitations/{token}` mixed-security 로 빌드 실패 — 를 **method-aware 재설계** 로 해결:

- 출력 schema: `PUBLIC_PATH_REGEXES: ReadonlyArray<RegExp>` → `PUBLIC_OPERATIONS: ReadonlyArray<{method, regex}>`
- `isPublicPath(url)` → `isPublicPath(method, url)` — axios `InternalAxiosRequestConfig.method` 가 항상 lowercase 정규화되어 OpenAPI method key 와 직접 비교 가능
- 호출처 갱신: [scripts/extract-public-paths.mjs](../../services/admin/scripts/extract-public-paths.mjs), [shared/api/axiosInstance.ts](../../services/admin/src/shared/api/axiosInstance.ts) (request/response interceptor 2곳), [shared/api/index.ts](../../services/admin/src/shared/api/index.ts) (barrel)
- 기존 axiosInstance 5개 테스트 그대로 통과 (시그니처 변경이지만 mock 의존성 없음)

### codegen 우회 (Task 7b)

dev API 가동 시도 → `STORAGE_AGENT_SOCKET_PATH` env 키 누락(v0.1 base 의 storage-agent Phase 2 후행 결함, M3 범위 외) 으로 가동 실패. `api.env` 에 키를 추가하면 [hookify.warn-env-write](../../.claude/hookify.warn-env-write.local.md) 위반이라 우회 안 함.

대안으로 **`generated/{types,sdk,@tanstack/react-query,index}.gen.ts` 4개 파일에 admin endpoint 부분만 수동 추가** — hey-api codegen 형식을 정확히 모사 (InvitationControllerCreate 패턴 거울). NAS 배포 직전 사용자가 `npm run openapi:codegen` 1회 실행하면 idempotent 하게 평소화됨.

### FSD 슬라이스 구조

- `entities/admin-user/` — `AdminUser` type + `useAdminUserListQuery` (entities/user 와 도메인 분리: user = 자기 신원, admin-user = 관리자가 보는 다른 사용자)
- `features/user-list/` — Container pattern: `UserListSection` (분기) + `UserListTable`/`Empty`/`Error` (presentational)
- `features/user-invite/` — `useInvite` (mutation + result state) + `InviteDialog` (native `<dialog>` element + RHF). native dialog 로 focus trap/ESC/backdrop 자동 처리 → WCAG 2.1.1/2.4.7/2.4.11/4.1.3 일괄 만족
- `pages/admin/users/` — `AdminUsersPage` (UserListSection + InviteDialog 합성, useState 로 dialog open 제어)

### Router

- `/admin` index = `<Navigate to="/admin/users" replace>` (AdminPlaceholderPage 삭제)
- `/admin/users` = AdminUsersPage
- AdminLayout 사이드바: NavLink "사용자" 활성화 (focus-visible ring 포함)

### Catalyst 정책

본 M3 는 admin 의 catalyst 마이그레이션 범위 밖이라 신규 컴포넌트도 zinc-* 톤 + 기존 catalyst Button/Heading 일관성 유지. mobile-ui-guide §8 적용은 services/web 의 design-system-v1 PRD 별도 트랙.

### 검증 결과

- tsc: EXIT 0
- ESLint: 0 errors, 18 warnings (모두 generated 파일의 unused eslint-disable — M3 범위 외 기존 noise)
- vitest: 15 test files / 64 tests pass (admin M2 회귀 0 + M3 신규 26 tests = useInvite 4 + InviteDialog 5 + UserListTable 3 + UserListEmpty 3 + UserListError 3 + UserListSection 3 + AdminUsersPage 2 + 기존 회귀 41)
- build: 426 modules, 159kb gzipped JS, 8.59kb CSS — app page 300kb budget 안

### 사용자 인계 사항

1. **NAS 배포 (Task 11)**: DSM Application Portal 에 admin.drive.skypark207.com 추가 + `/volume3/docker/terab/admin.prod.env` 생성 + master merge + `make stack-update`
2. **codegen 평소화**: NAS 가동 후 (또는 v0.1 base 의 `STORAGE_AGENT_SOCKET_PATH` 결함 해결 후) `cd services/admin && npm run openapi:codegen` 1회 실행 — 산출물이 본 plan 의 수동 갱신과 정합 (PR 머지 후 노이즈 0건이 정상)
3. **e2e 4단계 (Task 12)**: admin 로그인 → /admin/users 진입 → invite 발급 → URL 복사 → services/web `/register/<token>` 가입 → admin 목록 새로고침
4. **ADR-0006 status accepted 갱신**: PR 머지 후 별도 commit (ADR-0005 패턴 — PR 번호 + 머지일 채움)
5. **storage-agent env 결함 보고**: `STORAGE_AGENT_SOCKET_PATH` 가 `api.env.example` 또는 v0.1 base 에서 누락 — admin worktree 가동 시 발견. 본 plan 범위 외이지만 후속 처리 필요

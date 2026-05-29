---
name: admin-user-invite-list
description: services/admin 의 A-05 사용자 초대 + A-03 사용자 목록 — services/api 의 `/admin/*` 모듈 + admin frontend 의 invite/list FSD 슬라이스 + NAS 배포 + 본인 e2e (1명 초대 → 가입 → 로그인 → 목록 표시)
status: in-progress
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
| 7 | services/admin codegen + entities/admin-user 슬라이스 | pending — 사전 결함: `extract-public-paths.mjs` 가 `/invitations/{token}` mixed-security 로 실패. 사전 수정 필요 (method-aware 재설계 or 별도 패치) | dev API 가동 후 `npm run openapi:codegen` 통과 |
| 8 | services/admin features/user-list (UserListTable/Empty/Error + tests) | pending | vitest pass, build pass |
| 9 | services/admin features/user-invite (RHF + mutation + InviteDialog + tests) | pending | vitest pass, build pass |
| 10 | pages/admin/users + router 갱신 + AdminLayout 사이드바 활성화 + AdminPlaceholderPage 삭제 | pending | npm run dev 후 본인 admin → /admin/users 표시 |
| 11 | NAS 배포 (DSM 라우팅 + admin.prod.env + master merge) | pending — 사용자 인계 | docker service ls + curl admin.drive.skypark207.com 200 |
| 12 | e2e 본인 1명 초대 → 가입 → 로그인 → 목록 표시 | pending — 사용자 인계 | 4단계 시각 확인 통과 |
| 13 | services/admin/CLAUDE.md + PRD M3 row + ADR-0006 status 갱신 | pending | grep 확인 |

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
- [ ] Task 7~10 (services/admin side) 완료 + build/test/번들사이즈 통과
- [ ] Task 11 NAS 배포 후 admin.drive.skypark207.com 200, /admin/users 401 (no token), drive.skypark207.com 회귀 없음
- [ ] Task 12 e2e 4단계 시각 통과
- [ ] PRD M3 row done 갱신, ADR-0006 status accepted 로 갱신
- [ ] PR diff 에 services/web 0줄 수정 (M3 가 web 비편집)
- [ ] 모든 변경이 worktree `.worktrees/admin-m3-users-invite-list/` 안 ([CLAUDE.md worktree 정책](../../CLAUDE.md))

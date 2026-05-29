# ADR-0006 — ADMIN-only API 의 `/admin` prefix + `src/admin` 모듈

## Status

proposed — 2026-05-29

## Context

services/admin (admin SPA, M2 부트스트랩 완료) 가 운영자 전용 화면에서 사용자 목록·초대 발급 등을 호출하려면 services/api 에 대응 endpoint 가 필요하다. M3 plan 의 핵심 결정 시점에 두 가지 선택지가 있었다:

- **옵션 A**: services/api 의 `src/admin/` 신규 도메인 모듈을 만들고 `/admin/*` prefix 로 endpoint 노출. controller 는 `@RequirePermission('user:read' | 'user:invite' | ...)` 만 두고, 핵심 로직은 기존 `InvitationService` / `UserService` 위임.
- **옵션 B**: 기존 controller (예: `InvitationController`) 에 admin 전용 메서드를 추가해 한 컨트롤러가 user 용 + admin 용 endpoint 를 동시에 제공.

옵션 B 는 controller 수가 적어 일견 간단해 보이지만 (1) admin 전용 정책(권한 게이트 일괄 적용, 응답 envelope 정책 차이, 향후 admin OpenAPI 분리) 을 controller 단위로 묶어두기 어렵고, (2) admin 전용 surface 가 늘어날수록 매 controller 마다 admin 메서드가 흩어져 grep·코드 리뷰의 인지부담이 커진다.

services/admin 가 단일 빌드의 운영자 surface 라는 점, 그리고 향후 ADMIN 권한 검사 라인이 controller 단위로 강제되어야 한다는 PRD 결정(`user:read` / `user:invite` / `user:manage` 등의 권한 필수)을 고려할 때, **admin 전용 도메인 모듈 + `/admin/*` prefix** 가 정책을 코드 구조로 박제하는 방향이다.

## Decision

services/api 에 **`src/admin/`** 신규 도메인 모듈을 도입한다.

- 경로 prefix: 모든 admin 전용 endpoint 는 `/admin/...` 으로 시작한다.
- 디렉토리 구조: `src/admin/{admin.module.ts, *-admin.controller.ts, dto/}`.
- controller 는 admin 정책(권한 게이트·로깅·향후 admin-전용 envelope) 만 담당하고, 핵심 로직은 기존 도메인 service (예: `InvitationService`, `UserService`) 에 위임한다.
- 신규 admin 전용 service / repository 는 *원칙적으로 신설하지 않는다* — 기존 도메인 서비스의 메서드 추가(예: `UserService.listUsers`) 가 우선. admin 전용 비즈니스 로직이 정말 필요한 경우에만 `AdminService` 신설을 검토한다.
- `@ApiTags('AdminInvitation')`, `@ApiTags('AdminUser')` 등 admin 접두 태그를 사용해 OpenAPI 상에서 admin surface 가 구분되도록 한다.

## Consequences

### Positive

- admin 정책(권한 게이트 강제·향후 admin 전용 envelope) 이 단일 모듈에 모여 코드 리뷰·grep 비용이 낮다.
- services/admin 의 codegen 산출물이 path-prefix 기준으로 admin SDK 함수와 user SDK 함수를 자연스럽게 분리한다 (`adminUserList`, `invitationAdminCreate` 등 hey-api 의 tag 처리에 의존).
- 신규 admin 화면이 늘어날 때 추가할 위치(`src/admin/` 내부)가 명확하다 — 일반 도메인 controller 가 비대해지지 않는다.
- 향후 admin OpenAPI 만 별도 spec 으로 추출(서명 분리·운영자 docs 분리 등) 하려 할 때 prefix 기반 필터로 간단히 가능.

### Negative

- 동일한 도메인(예: invitation) 의 controller 가 user surface + admin surface 두 개로 분리되어 endpoint 갯수가 늘면 *형식적인 중복* 처럼 보일 수 있다. (controller 가 service 위임만 하므로 실제 로직 중복은 없다.)
- admin module 이 다른 도메인 module 을 import 하는 단방향 의존이 생긴다 — 그러나 admin → 도메인 방향은 자연스럽고 순환 위험이 없다.
- admin 전용 endpoint 의 path 와 user surface 의 path 를 서로 모르고 비슷하게 짓는 사고가 가능 (예: `/users` vs `/admin/users`). PR review checklist 에서 prefix 일관성 확인 필요.

### Mitigations

- admin endpoint 의 path 는 항상 `@Controller('admin/...')` 로 시작 — services/api/CLAUDE.md "신규 모듈 생성 시 체크리스트" 에 명시.
- admin module 의 `imports` 는 admin 이 의존하는 도메인 module 만 — 신규 의존이 생길 때 PR 검토에서 정당성 확인.
- admin module 에 신규 service / repository 가 들어가는 경우 ADR 갱신 또는 후속 ADR 으로 결정 사유 영속화.

## References

- PRD: `.claude/prds/admin-service-bootstrap.prd.md` — M3 가설 검증 ("본인이 사용자 1명 초대 → 가입 → 로그인")
- Plan: `.claude/plans/admin-user-invite-list.plan.md` — M3 의 구현 단위 (이 ADR 의 첫 구현)
- 구현 PR: feat/admin-m3-users-invite-list (TBD — 본 ADR 의 reference 갱신 시점)
- 코드: `services/api/src/admin/admin.module.ts`, `services/api/src/admin/invitation-admin.controller.ts`, `services/api/src/admin/user-admin.controller.ts`
- 관련 컨벤션: [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"신규 모듈 생성 시 체크리스트", `@RequirePermission` decorator 사용 정책
- 관련 ADR: 0001 (Swagger 기반 codegen — `/admin/*` path 자동 인식), 0002 (2FA Strategy — 권한 게이트 일관성)

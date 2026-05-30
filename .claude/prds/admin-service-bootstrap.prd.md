# Admin 서비스 부트스트랩 (services/admin)

## Problem

terab 운영(사용자 초대/가입/관리, 스토리지 모니터링, 감사)에 필요한 ADMIN-only 기능이 IA 문서로는 A-01 ~ A-15 (15개 화면)까지 정의되어 있으나 구현체가 없다. 그 결과 (a) 실제 브라우저에서 ADMIN-only API 를 nginx 너머로 테스트할 수 없고, (b) Claude/개발자가 관리자 기능을 일반 사용자 앱 `services/web` 에 잘못 붙이려는 architectural drift 압력이 발생한다. v1.0 배포가 임박한 시점에 운영 도구가 없으면 장애 대응이 불가능하며, "NAS Docker Swarm 에 또 하나의 서비스를 stack 으로 띄울 수 있는가" 라는 배포 파이프라인 검증도 함께 못 한다.

## Evidence

- IA 정의 완료: [docs/planning/screen-spec.md:64-99](../../docs/planning/screen-spec.md) — A-01~A-15, Must/Should/Could 우선순위, 요구사항 ID(ADMIN-01~06, ADMIN-17, ADMIN-18) 매핑 완료
- 레이아웃 정의 완료: [docs/planning/screens/common-layouts.md](../../docs/planning/screens/common-layouts.md) — Layout-B (Admin Web) 정의됨. `admin.drive.skypark207.com` 도메인 기준 명시
- 사용자 진술 (2026-05-27): "초대 기반 사용자 생성 기능... 웹 수준(nginx)에서 테스트가 불가능하고 있음"
- 사용자 진술 (2026-05-27): "서비스조차 생성되지 않아 Claude가 작업할 때 관리자 전용 기능을 web에 붙이려고 함" — architectural drift 의 직접 evidence
- 운영 상태: 현재 활성 worktree 5개 (`feat/design-system-v1`, `feat/folder-crud`, `feat/mobile-app-feel`, `feat/storage-foundation`, `feat/admin-service-bootstrap`) — multi-track 개발 환경에서 admin 결여가 차단 요소로 부각

## Users

- **Primary**: NAS 운영자 (본인) — terab 인프라/사용자 관리 책임자. 운영 트리거: 신규 가족 사용자 추가 요청, 스토리지 사용량 점검, 가입 정책 변경
- **Secondary**: NAS 를 같이 쓰는 가족 운영 위임자 (1~2명) — 본인 부재 시 단순 사용자 초대 정도만 수행
- **Not for**:
  - 일반(비-ADMIN) 사용자 — `services/web` 이 담당
  - 모바일 사용자 — admin 자체가 데스크탑 전용
  - 외부 SaaS 고객(멀티 테넌트 운영자) — 셀프호스팅 단일 NAS 범위

## Hypothesis

우리는 **`services/admin` (admin.drive.skypark207.com 으로 접근하는 데스크탑 전용 React 19 + Vite + TS 웹앱) 신규 서비스 구축**이 운영자에게 **(1) 사용자 초대/관리 같은 ADMIN-only 작업을 nginx 너머 실제 브라우저에서 수행 가능하게 하고, (2) admin 기능이 services/web 으로 흘러드는 architectural drift 를 코드 경계에서 차단**할 것이라 믿는다.

우리는 다음 조건이 모두 충족되면 옳다는 것을 안다:

- v1.0 배포 시점에 `admin.drive.skypark207.com` 이 NAS Docker Swarm stack 에서 정상 기동되고 헬스체크 통과,
- 본인이 브라우저에서 사용자 1명을 **초대 → 가입 → 첫 로그인** 까지 완주 가능,
- 본 PRD 종료 후 4주간 신규 PR 중 admin 성격(사용자/역할 관리 UI)을 `services/web` 에 추가하는 PR 0건.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| admin.drive.skypark207.com 가용성 (배포 검증) | NAS Swarm stack 배포 후 1회 이상 HTTP 200 응답 | 수동 curl + nginx access log |
| 사용자 초대→가입→로그인 end-to-end | 1명 완주 | 본인 수동 confirm 기본. 가능 시 Playwright E2E 1 scenario 로 자동화 |
| services/web 에 admin UI drift | 0건 | PRD 종료 후 N=4주간 services/web 에 merge 되는 PR 중 ADMIN 역할 전용 화면 추가 PR 카운트 |

## Scope

### MVP (1차 배포 묶음)

> **목표**: "프로토타입 수준이라도 NAS Docker 환경에 admin 이 배포되고, 가장 아픈 운영 공백(사용자 초대 테스트 불가) 을 해소"

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| M1 | 서비스 부트스트랩 | done | services/admin 디렉토리, Vite, React 19 + TS, Dockerfile, Docker Swarm stack 등록, nginx 라우팅(`admin.drive.skypark207.com`), 헬스체크 |
| M2 | A-01 관리자 로그인 (Layout-C) | done | 일반 사용자 D-01 의 Push 2FA + backup code 인증 정책 그대로 재사용. 동일 access token + ADMIN role claim 검증 |
| M3 + M4 | A-05 사용자 초대 + A-03 사용자 목록 (Layout-B) | code complete — NAS 배포 + e2e pending | 가장 아픈 운영 공백 — `services/api/src/admin/` 모듈 + `POST /admin/users/invitations` + `GET /admin/users`, services/admin `features/user-invite/`, `features/user-list/`, `pages/admin/users/`. 동일 plan ([admin-user-invite-list.plan.md](../plans/admin-user-invite-list.plan.md))으로 묶어 진행 ([ADR-0006](../../docs/adr/0006-admin-api-prefix-and-module.md)) |

### Out of scope

- **A-02 대시보드, A-04 사용자 상세, A-08 스토리지 대시보드** — Must 우선순위지만 다음 milestone (MVP 가설 검증에 직접적 영향 없음)
- **A-06 ~ A-15 Should/Could 화면 전체** — 역할 관리, 공유 관리, 시스템/서비스 모니터링, 가입 정책, 감사 로그, 활동 통계
- **모바일/태블릿 반응형 레이아웃** — admin 은 데스크탑 전용 (사용자 명시)
- **Capacitor admin 앱 빌드** — admin 은 웹 전용 (사용자 명시)
- **별도 admin 인증 토큰 분리** — Open Q 해소: `(a) 동일 token + ADMIN role claim`
- **외부 SaaS 수준의 모든 read 액션 감사 로그** — 본인+가족 1~2명 스케일 과잉

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | services/admin 부트스트랩 + admin.drive.skypark207.com 배포 | NAS Swarm stack 에 admin 컨테이너 정상 기동, 빈 페이지라도 도메인으로 접근 가능 + 헬스체크 통과 | impl-complete · deploy-pending | [.claude/plans/completed/admin-service-bootstrap.plan.md](../plans/completed/admin-service-bootstrap.plan.md) · [report](../PRPs/reports/admin-service-bootstrap-report.md) |
| 2 | A-01 관리자 로그인 동작 | 본인이 ID/PW + Push 2FA + backup code 로 로그인 → ADMIN role claim 검증된 토큰으로 admin 진입 | impl-complete · deploy-pending | [.claude/plans/completed/admin-login-twofa.plan.md](../plans/completed/admin-login-twofa.plan.md) · [report](../PRPs/reports/admin-login-twofa-report.md) |
| 3 | A-05 사용자 초대 + A-03 사용자 목록 동작 | 본인이 브라우저에서 새 사용자 초대 → 가입 → 사용자 목록에 표기 + 본인 로그인 가능 | pending | — |

## Open Questions

Phase 3 시점에 4건 모두 답변 완료. 후속 새 의문 발생 시 본 섹션에 추가.

**해소된 결정 (참고)**:

- **인증 분리 정책**: 동일 토큰 + ADMIN role claim. API 구현은 `services/api/src/admin/*` 하위, 모든 admin router 는 `/admin` prefix
- **A-01 2FA**: D-01 Push 2FA + backup code 정책 그대로 재사용 (web user 와 동일 로그인 정책)
- **API client**: `@hey-api/openapi-ts` 동일 방식. admin OpenAPI tag 만 추출, URL `/admin` prefix
- **MVP 자동화**: 수동 confirm 기본 + Playwright E2E 가능 시 자동화

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ADMIN-only API (`/admin/*`) 가 services/api 에 아직 없거나 `/admin` prefix 미적용 | High | High | M3 plan 시작 전에 `services/api/src/admin/` 모듈 존재 여부 확인. 없으면 M3 범위에 API 측 작업(또는 별도 PRD 분기) 포함 |
| Push 2FA 가 모바일 앱(D-01c) 미배포 상태에서 admin 로그인 차단 → 락아웃 | Medium | High | backup code 발급(D-02a)이 services/web 회원가입 시점에 작동하는지 사전 확인. 안 되면 admin MVP 전 backup code 발급 경로 우선 보장 |
| nginx 에 admin 서브도메인 추가 시 기존 drive.skypark207.com 라우팅에 회귀 | Medium | High | 신규 server block 분리, 기존 server block 비편집. nginx config 변경 후 `nginx -t` + 기존 도메인 smoke test |
| Docker Swarm stack 에 서비스 1개 추가 시 NAS 리소스(메모리) 제약 | Low | Medium | 부트스트랩 이미지는 정적 빌드 + nginx-alpine 기반으로 최소화. 컨테이너 기동 후 NAS 메모리 사용량 1회 측정 |
| `@hey-api/openapi-ts` 생성 client 가 admin tag 분리 미지원 | Medium | Medium | Plan 단계에서 hey-api tag filter 옵션 확인. 미지원이면 별도 OpenAPI 입력 파일 생성 또는 wildcard 후 트리쉐이킹 |
| MVP 사용자 초대→가입 e2e 가 메일 발송 인프라(SMTP) 미설정으로 차단 | Medium | High | Plan 단계에서 services/api 의 invite 로직 채널(mail/inline link) 확인. SMTP 미설정이면 inline link 표시 fallback 으로 MVP 통과 |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*

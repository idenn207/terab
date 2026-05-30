---
name: services-web-feature-parity-phase10-could-polish
description: Phase 10 (Could - Polish) — share link API+UI · device management UI · 반응형 visual regression · a11y axe 게이트
status: in-progress
created: 2026-05-30
---

# Plan: services/web Feature Parity — Phase 10 Could Polish

> **Worktree advisory**: 본 plan 의 구현은 `.worktrees/feat-web-phase10-polish/` 에서 진행한다 ([CLAUDE.md "모든 작업은 worktree 에서 진행"](../../CLAUDE.md)). plan 산출물 자체는 main 에서 작성됐고, 구현 진입 시 worktree 분기.

## Summary

services/web 의 v1.0 polish phase. PRD 의 Could 우선순위 4 개 sub-area (공유 링크 · 디바이스 관리 · 반응형 회귀 · a11y) 를 한 plan 으로 묶어, MVP 시나리오 통과 후 "운영에 들여놓아도 거슬리지 않는 마감" 까지 가져간다. 단일 plan 이지만 sub-area 별로 task 가 분리돼 있어 sub-area 단위로 PR 분할 가능. 공유 링크는 services/api 측 controller·service·repository 신설 동반 (`share_links` 신규 schema — 기존 `share_grants` 와 분리).

## User Story

As **모바일↔PC 를 오가는 1인 개발자 본인**,
I want **(1) 공유 링크로 NAS 파일을 외부 지인에게 임시 노출, (2) 신뢰기기를 직접 보고 의심스러운 항목을 회수, (3) 320/768/1024/1440 에서 깨지지 않는 화면, (4) axe-core 자동 a11y 게이트** 를,
so that **v1.0 출시 후 운영 중 발생하는 잔여 통점이 모두 해결되고, 본인이 안심하고 일상 사용할 수 있다**.

## Problem → Solution

**현재 상태**:

- **공유 링크**: services/api 에 `share.controller.ts` 부재 — schema 에 `share_grants` 만 있고 이는 *user-to-user drive grant* 라 토큰 기반 anonymous link 와 모델이 다름 ([share-grants.schema.ts:6](../../services/api/src/database/schema/share-grants.schema.ts))
- **디바이스 관리**: API 는 `GET /trusted-device` · `DELETE /trusted-device/:id` 동작 중 ([trusted-device.controller.ts](../../services/api/src/trusted-device/trusted-device.controller.ts)), web 에는 로그인 흐름의 `features/trusted-device/` 만 존재 — 조회/해제 UI 부재
- **반응형 회귀**: Playwright 설치돼 있지만 (`@playwright/test@^1.60.0`) visual diff baseline 없음. 320/768/1024/1440 breakpoint 별 회귀 테스트 부재
- **a11y**: `test-infra-axe` worktree 가 `vitest-axe` matcher 등록 + `TrustThisDeviceCheckbox` Headless.Field 수정 시작 — 미머지 상태. 컴포넌트별 axe 검사 + reduced-motion 검증 부재
- **stub pages**: `pages/s/`, `pages/share/`, `pages/settings/` 모두 `index.ts` 1줄짜리 빈 stub

**목표 상태**:

- **공유 링크 (서버)**: `share.module.ts` 신설, `share_links` schema 추가, `POST /share-link` (생성) · `GET /share-link/:token` (공개) · `DELETE /share-link/:id` (회수) · `GET /share-link` (내 링크 목록) 4 endpoints
- **공유 링크 (web)**: `features/share-link-create/-revoke`, `entities/share-link`, `pages/s/[token]` 공개 뷰 (인증 우회), `pages/share` 내 링크 관리 페이지
- **디바이스 관리 (web)**: `features/device-list/-revoke`, `pages/settings/devices` — drive 페이지 와 동일한 `widgets/sidebar-layout` 안에 마운트
- **반응형 회귀 (web/testing)**: Playwright 의 4 breakpoint × 4 주요 페이지(login, drive, trash, settings) snapshot baseline + CI 게이트
- **a11y 게이트**: `test-infra-axe` 의 vitest-axe 매처 위에 컴포넌트 별 `expect(html).toHaveNoViolations()`, `prefers-reduced-motion: reduce` Playwright project 추가, drive/login/modal flow axe-playwright 통합

## Metadata

- **Complexity**: Large (4 sub-area, API 신설 + schema migration + visual regression infra)
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- **PRD Phase**: Phase 10 — Could · Polish
- **Estimated Files**: 신규 ~38 (share API 7 + share web ~10 + device mgmt web ~8 + visual snapshot ~8 + a11y test ~5), UPDATE ~12 (router, sidebar menu, package.json, playwright.config 등)
- **Estimated Duration**: 5~7 일 (share end-to-end ~3 일 + device mgmt ~0.5 일 + visual regression infra+baseline ~1.5 일 + a11y rollout ~1 일 + 검증 ~1 일)
- **Selected milestone**: Phase 10 — Could · Polish

---

## Open Decisions

> Plan 확정 전 사용자 결정 필요.

| # | 결정 | 후보 | 권장 | Why |
|---|---|---|---|---|
| D1 | 공유 링크 권한 모델 | (a) 새 `share_links` 테이블 (token 기반 anonymous) / (b) 기존 `share_grants` 확장 (user-to-user) / (c) 둘 다 | (a) | PRD 의 "공유 링크" 표현 + 본인 + 가족·지인 임시 노출 시나리오 — token URL 이 자연스러움. `share_grants` 는 drive-level user grant 라 의미·UX 다름. 둘 다 만들면 v1.0 범위 초과 |
| D2 | 공유 링크 인증 정책 | (a) 토큰만 / (b) 토큰 + 비밀번호 / (c) 토큰 + 만료 (필수) | (a) 토큰만 + 만료 옵션 | NAS 셀프호스팅 + 본인 가족·지인 한정. 비밀번호는 v1+ (사용자 멘탈 부담). 만료는 옵션 (없으면 즉시 해제될 때까지 유효) |
| D3 | 공유 링크 access 범위 | (a) 단일 파일 / (b) 폴더 (재귀 포함) / (c) 둘 다 | (c) 둘 다 | 사진 1 장 vs 앨범 전체 두 시나리오 모두 자연스러움. resource type discriminator + (fileId 또는 folderId) 단순 union 으로 충분 |
| D4 | 디바이스 관리 페이지 위치 | (a) `pages/settings/devices` / (b) drive sidebar 의 별도 메뉴 / (c) login flow 안 modal | (a) settings 하위 | 일상 흐름 밖 (보안 행동) — settings 가 자연스러움. drive sidebar 는 file 중심이므로 분리 |
| D5 | 반응형 baseline 페이지 | (a) login + drive + trash + settings 4 페이지 / (b) 위 + share 공개 뷰 5 페이지 / (c) drive·trash 만 2 페이지 | (b) 5 페이지 | share 공개 뷰는 비로그인 외부인이 보는 *유일한* 페이지라 반드시 baseline. 5 페이지 × 4 breakpoint = 20 snapshot, CI 시간 합리 |
| D6 | `test-infra-axe` worktree 처리 | (a) 본 plan task D1 의 *전제* 로 별도 PR 머지 후 본 plan 진입 / (b) 본 plan 안에서 cherry-pick / (c) 본 plan task D1 이 동일 작업 다시 수행 | (a) 별도 PR | `test-infra-axe` 는 이미 작업 시작됐고 본 plan 진입 전 머지하면 충돌 위험 0. b/c 는 git history 복잡 |
| D7 | reduced-motion 검증 방식 | (a) Playwright `prefers-reduced-motion: reduce` project + 별도 snapshot baseline / (b) Vitest 컴포넌트 단위 only / (c) 검증 안 함 | (a) | 모바일 OS 시스템 설정 영향 직접 시뮬레이션. b 만으로는 실 동작 보장 부족. c 는 WCAG 2.3.3 위반 위험 |
| D8 | PRD 갱신 책임 | (a) 본 plan 머지 시점에 PRD 의 Phase 8 (실제 done 인데 표 에 pending) · Phase 9 (실제 done 인데 표 에 in-progress) · Phase 10 status sync / (b) 별도 docs PR | (a) | 본 plan 이 마지막 phase 이므로 status sync 가 한 번에 끝남. 분리는 PR 2 번 |

권장 8 개를 그대로 채택할지, 일부 수정할지 plan 확인 시 결정한다.

---

## Decisions Log

> `/ecc:prp-implement` 진입 시점(2026-05-30)에 사용자가 D1–D8 권장 8개를 그대로 채택. 본 plan 의 진행 중 가정. 향후 sub-area 진입 시점에서 환경 변화로 재검토가 필요하면 본 표에 *행 추가* 로 superseding decision 을 남기고 이유를 함께 기록한다.

| # | Decision (accepted) | Source | Acceptance reason |
|---|---|---|---|
| D1 | 공유 링크 — 새 `share_links` 테이블 (token 기반 anonymous) | Open Decisions D1 권장 (a) | `share_grants` 는 user-to-user drive grant 라 token URL 모델과 의미가 다름. 둘 다 만들면 v1.0 범위 초과 |
| D2 | 공유 링크 인증 — 토큰만 + 만료 옵션 (비밀번호 없음) | Open Decisions D2 권장 (a) | 본인 + 가족·지인 한정 NAS 셀프호스팅. 비밀번호는 멘탈 부담. 만료는 옵션 |
| D3 | 공유 링크 access — 파일 또는 폴더 (resource type union) | Open Decisions D3 권장 (c) | 사진 1장 vs 앨범 전체 두 시나리오 모두 자연스러움 |
| D4 | 디바이스 관리 페이지 — `pages/settings/devices` | Open Decisions D4 권장 (a) | 일상 흐름 밖 (보안 행동). drive sidebar 는 file 중심이므로 분리 |
| D5 | 반응형 baseline — 5 페이지 (login + drive + trash + settings + share-public) × 4 viewport | Open Decisions D5 권장 (b) | share 공개 뷰는 비로그인 외부인이 보는 *유일한* 페이지라 반드시 baseline |
| D6 | `test-infra-axe` worktree — 별도 PR 우선 머지 후 본 plan 진입 | Open Decisions D6 권장 (a) | 본 plan 진입 시점에 PR #75 가 OPEN — D-prereq 충족 안 됨. **본 plan 의 sub-area D 는 PR #75 머지 후 분리 진입** (아래 "진입 차단 / 분리" 참조) |
| D7 | reduced-motion 검증 — Playwright `prefers-reduced-motion: reduce` project + 별도 snapshot | Open Decisions D7 권장 (a) | 모바일 OS 시스템 설정 영향 직접 시뮬레이션. vitest 단독은 실 동작 보장 부족. WCAG 2.3.3 호응 |
| D8 | PRD 갱신 — 본 plan 머지 시점에 Phase 8/9 status `done`, Phase 10 status `done` 동기화 | Open Decisions D8 권장 (a) | 본 plan 이 마지막 phase 이므로 status sync 가 한 번에 끝남 |

### 진입 차단 / 분리 (2026-05-30 결정)

- **오늘 세션 scope**: **Sub-area A — Device Management 만**. D 는 D-prereq (PR #75) 미머지로 블록, B/C 는 별도 PR.
- **PR 분할**: 1 worktree (`feat/web-phase10-polish`), sub-area 별 별도 PR. plan 의 risk 표 "큰 plan 으로 PR 1 개가 부피 폭주" H risk 회피.
- **진행 순서**: A (오늘) → B (다음) → C (그 다음) → D (PR #75 머지 후). sub-area 별 1 PR.
- **D6 변형**: 권장 (a) 그대로 채택했으나 본 plan 의 sub-area D 는 PR #75 머지 완료 시까지 *별도 PR 로 분리 진입* — 본 plan 안에서 task D1/D2 자체 는 *미진입 상태* 로 남겨둠.

### Sub-area A 구현 deviation (2026-05-30, Option β 채택)

| 항목 | Plan 원본 | Codebase 실제 | Deviation 결정 |
|---|---|---|---|
| `entities/trusted-device` 신설 | Task A1 — `useDeviceListQuery` codegen wrapper | `features/trusted-device/api/query.ts` 가 이미 `useTrustedDevicesQuery` 보유 | **skip** entities 신설. 동일 wrapper 중복 회피 (YAGNI) |
| `features/device-list` + `features/device-revoke` 두 slice 신설 | Task A2 — 분리된 read / mutation slice | `features/trusted-device/api/{query,mutation}.ts` + `model/useTrustedDevice.ts` 가 list + register + revoke 모두 보유. `ui/TrustedDeviceSection.tsx` 는 list 렌더링이 *통째 주석* 인 stub | 두 신규 slice 대신 **기존 `features/trusted-device` 확장** — `TrustedDeviceSection.tsx` 스텁 채우기 + `TrustedDeviceRevokeDialog` 신설 (folder-delete 패턴 미러) |
| `drive-sidebar` 에 "설정" 메뉴 추가 | Task A3 | [drive-sidebar/model/navigation.ts:13](../../services/web/src/widgets/drive-sidebar/model/navigation.ts#L13) 에 `Cog6ToothIcon` + `/settings` 이미 등록됨 | **skip** sidebar 수정. 라우트만 추가 |
| 자기-revoke 시 `queryClient.invalidateQueries(['session'])` | Task A2 본문 | 본 codebase 의 auth state 는 Zustand (entities/user) 이지 TanStack Query 아님 → `['session']` queryKey 존재 안 함 | **자연 우회**: revoke 후 다음 protected 요청이 axios refresh 인터셉터에서 401 → `/login` 리다이렉트. 기존 `useRevokeTrustedDeviceMutation` 의 list invalidation 만 유지 |

**Net 효과**: plan task A1/A2/A3 의 *목적*(devices 페이지에서 목록 + revoke + 사이드바 진입) 은 그대로 달성. 신설 slice 0개, 기존 slice 확장 + pages 신설 + router 1 곳 추가로 *최소 diff* 진입. plan 의 success metric ("기기 목록 + 회수 동작 + 자기 자신 회수 시 재로그인 요구") 는 모두 충족.

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| API controller anatomy | [services/api/src/trusted-device/trusted-device.controller.ts](../../services/api/src/trusted-device/trusted-device.controller.ts) | `@Controller('domain')` + `@ApiTags('Domain')` + `@ApiOperation` + `@ApiResponse` + `@ApiError`, `@Public()` 만 토큰 공개 endpoint 에 |
| API service / repository 분리 | [services/api/src/folder/](../../services/api/src/folder/) | service 가 비즈니스 룰, repository 가 Drizzle 만, ApiException 으로 도메인 에러 |
| Schema 신설 | [services/api/src/database/schema/share-grants.schema.ts:6](../../services/api/src/database/schema/share-grants.schema.ts) | `pgTable` + `t.uuid().defaultRandom()` PK + `.references(() => ...)` + 명시 인덱스 |
| ErrorCode 등록 | services/api/src/common/exceptions/error-code.enum.ts | `{ message: '한글', status: HttpStatus.XXX }` |
| Web FSD api slice | [services/web/src/features/file-search/api/query.ts:1](../../services/web/src/features/file-search/api/query.ts) | `useXxxQuery` wrapper, codegen 직접 import 금지, TanStack Query + keepPreviousData |
| Web FSD model slice | [services/web/src/features/file-search/model/useFileSearch.ts](../../services/web/src/features/file-search/model/useFileSearch.ts) | URL state 단일 진실원, `../api/...` 만 import |
| Web FSD ui slice | [services/web/src/features/file-search/ui/SearchInput.tsx](../../services/web/src/features/file-search/ui/SearchInput.tsx) | `shared/ui` headless + `cn()` + token utility only |
| Trusted device mutation+revoke | [services/web/src/features/trusted-device/](../../services/web/src/features/trusted-device/) | 본 plan 의 device mgmt sub-area 가 이 슬라이스를 확장 (list+revoke 추가) |
| Test setup (vitest-axe 매처) | [.worktrees/test-infra-axe/services/web/src/__tests__/setup.ts:1](../../.worktrees/test-infra-axe/services/web/src/__tests__/setup.ts) | `expect.extend({ toHaveNoViolations })` — vitest 4 의 chai augmentation 우회 |
| Playwright spec | [services/web/e2e/auth-flows.spec.ts](../../services/web/e2e/auth-flows.spec.ts) | `test('...', async ({ page }) => { ... })`, `expect(...).toBeVisible()` |

---

## Files to Change

### Sub-area B — Share Link (services/api)

| File | Action | Why |
|---|---|---|
| `services/api/src/database/schema/share-links.schema.ts` | CREATE | 신규 `share_links` 테이블 (token, resourceType, fileId\|folderId, expiresAt, revokedAt) |
| `services/api/src/database/schema/index.ts` | UPDATE | `share-links` re-export |
| `services/api/drizzle/<timestamp>_share_links.sql` | CREATE | `npm run db:generate` 산출물 |
| `services/api/src/share/share.module.ts` | CREATE | 도메인 모듈 |
| `services/api/src/share/share.controller.ts` | CREATE | 4 endpoints |
| `services/api/src/share/share.service.ts` | CREATE | 토큰 생성, 만료/회수, 권한 검증 |
| `services/api/src/share/share.repository.ts` | CREATE | Drizzle 쿼리 |
| `services/api/src/share/dto/{create-share-link.dto.ts, share-link-response.dto.ts, public-share-link-response.dto.ts}` | CREATE | request + response DTO |
| `services/api/src/app.module.ts` | UPDATE | `ShareModule` 등록 |
| `services/api/src/common/exceptions/error-code.enum.ts` | UPDATE | `SHARE_LINK_NOT_FOUND`, `SHARE_LINK_EXPIRED`, `SHARE_LINK_REVOKED`, `SHARE_LINK_RESOURCE_NOT_FOUND` |

### Sub-area B — Share Link (services/web)

| File | Action | Why |
|---|---|---|
| `services/web/src/entities/share-link/{api,model,index}.ts` | CREATE | 도메인 entity (타입 + list query) |
| `services/web/src/features/share-link-create/{api,model,ui}/...` | CREATE | 생성 mutation + dialog UI (file/folder 마다 트리거) |
| `services/web/src/features/share-link-revoke/{api,model,ui}/...` | CREATE | 회수 mutation + 메뉴 항목 |
| `services/web/src/widgets/file-list/ui/FileList.tsx` | UPDATE | 행 메뉴 에 "공유 링크" 항목 추가 |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx` | UPDATE | 폴더 컨텍스트 일 때 "현재 폴더 공유" 버튼 |
| `services/web/src/pages/share/ui/SharePage.tsx` | CREATE | 내 공유 링크 목록 (stub 채움) |
| `services/web/src/pages/s/ui/PublicSharePage.tsx` | CREATE | `/s/:token` — 비로그인 공개 뷰 |
| `services/web/src/app/router.tsx` | UPDATE | `/s/:token` 라우트 추가 (public), `/share` 라우트 추가 (auth) |

### Sub-area A — Device Management (services/web)

| File | Action | Why |
|---|---|---|
| `services/web/src/entities/trusted-device/...` | CREATE | 도메인 entity + list query |
| `services/web/src/features/device-list/{api,model,ui}/...` | CREATE | 목록 조회 + 표시 |
| `services/web/src/features/device-revoke/{api,model,ui}/...` | CREATE | revoke mutation + confirm dialog |
| `services/web/src/pages/settings/ui/SettingsPage.tsx` | CREATE | settings landing (devices 진입점) |
| `services/web/src/pages/settings/devices/ui/DevicesPage.tsx` | CREATE | 기기 목록 페이지 |
| `services/web/src/widgets/drive-sidebar/ui/DriveSidebar.tsx` | UPDATE | "설정" 메뉴 항목 추가 (favorites/recent 잔재가 있으면 함께 정리 — PRD 결정) |
| `services/web/src/app/router.tsx` | UPDATE | `/settings`, `/settings/devices` 라우트 |

### Sub-area C — Responsive Visual Regression

| File | Action | Why |
|---|---|---|
| `services/web/playwright.config.ts` | UPDATE | viewport projects (320, 768, 1024, 1440) + `prefers-reduced-motion: reduce` project (D7 채택 시) |
| `services/web/e2e/visual-regression.spec.ts` | CREATE | 5 페이지 × 4 viewport snapshot |
| `services/web/e2e/visual-regression.spec.ts-snapshots/...` | CREATE | baseline PNG (최초 `--update-snapshots` 1 회 실행) |
| `services/web/e2e/fixtures/auth.ts` | CREATE | 로그인 + share link fixture (visual regression 의존) |

### Sub-area D — A11y Gate

| File | Action | Why |
|---|---|---|
| (prereq) `test-infra-axe` worktree PR 머지 | EXTERNAL | vitest-axe 매처 등록 + TrustThisDeviceCheckbox fix |
| `services/web/src/widgets/drive-layout/ui/DriveLayout.test.tsx` | UPDATE | `toHaveNoViolations()` 추가 |
| `services/web/src/pages/drive/ui/DrivePage.test.tsx` | UPDATE | 동일 |
| `services/web/src/pages/login/...` 의 컴포넌트 spec | UPDATE | 동일 |
| `services/web/src/shared/ui/modal/Modal.test.tsx` | UPDATE | dialog focus trap + axe |
| `services/web/e2e/a11y.spec.ts` | CREATE | playwright-axe 통합 (login → drive → modal → settings flow) |
| `services/web/package.json` | UPDATE | `@axe-core/playwright` 추가 |

### PRD sync (D8 채택 시)

| File | Action | Why |
|---|---|---|
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Phase 8/9 status `done`, Phase 10 status `in-progress` → `done` 머지 시점, 표 stale 정리 |

---

## Tasks

> 각 task 는 *TDD*: 테스트 먼저, 구현 후. validate 명령은 task 단위 게이트.

### D — A11y (가장 먼저 — 다른 sub-area 검증 인프라 의존)

**D-prereq**: `test-infra-axe` worktree PR 머지 확인 — 본 plan 진입 전 완료 (D6 결정에 따름).

**Task D1**: drive·login·modal vitest-axe 검사 추가
- **Action**: 핵심 widget/page 의 `.test.tsx` 에 `expect(container.innerHTML).toHaveNoViolations()` 어설션 추가 (4~6 곳)
- **Mirror**: `test-infra-axe` worktree 의 vitest-axe 매처 사용 패턴
- **Validate**: `cd services/web && npm test -- --reporter=verbose | grep "toHaveNoViolations"` — 모든 어설션 통과

**Task D2**: `@axe-core/playwright` 통합 + a11y.spec.ts E2E
- **Action**: package.json 의존성 추가, `services/web/e2e/a11y.spec.ts` 작성 — login flow → drive → modal 열기 → trash 까지 page 별 `new AxeBuilder({ page }).analyze()` 실행
- **Mirror**: `services/web/e2e/auth-flows.spec.ts` 의 page interaction 패턴
- **Validate**: `npm run test:e2e -- e2e/a11y.spec.ts` — violations.length === 0

### A — Device Management (작고 빠른 win)

**Task A1**: `entities/trusted-device` 추가
- **Action**: `entities/trusted-device/{api/query.ts, index.ts}` — `useDeviceListQuery` (TanStack Query, codegen wrapper)
- **Mirror**: [services/web/src/entities/file/api/query.ts](../../services/web/src/entities/file/api/query.ts)
- **Validate**: `npm test -- entities/trusted-device` — query smoke test pass

**Task A2**: `features/device-list` + `features/device-revoke`
- **Action**: 두 슬라이스. revoke 는 confirm dialog (Phase 7 폴더 삭제 패턴 미러). 자기 자신 기기 revoke 시 즉시 로그아웃 처리 (revoke 응답 후 `queryClient.invalidateQueries(['session'])`)
- **Mirror**: `features/folder-delete/` 의 confirm + invalidate
- **Validate**: `npm test -- features/device-` — list + revoke + 자기-자신 revoke 시나리오 통과

**Task A3**: `pages/settings/devices` 라우트 + 사이드바 메뉴
- **Action**: SettingsPage (landing) + DevicesPage. drive-sidebar 에 "설정" 항목 추가. PRD 의 "최근/즐겨찾기 sidebar 제거" 미완 잔재 (pages/favorites, pages/recent) 도 D8 와 함께 정리할지 확인
- **Mirror**: pages/drive 의 widget 조합 패턴
- **Validate**: `npm run test:e2e -- e2e/auth-flows.spec.ts` 회귀 + manual: `/settings/devices` 접근 + revoke 동작

### B — Share Link (가장 크다 — API+web end-to-end)

**Task B1**: schema + migration
- **Action**: `share-links.schema.ts` 추가, index 갱신, `npm run db:generate`
- **Mirror**: `share-grants.schema.ts` 의 pgTable 구조 (단 grant 모델 X, link 모델 O)
- **Validate**: `npm run db:push` (dev DB) + `npm test -- database/schema` smoke

**Task B2**: ErrorCode 등록
- **Action**: `SHARE_LINK_NOT_FOUND` (404), `SHARE_LINK_EXPIRED` (410), `SHARE_LINK_REVOKED` (410), `SHARE_LINK_RESOURCE_NOT_FOUND` (404)
- **Mirror**: error-code.enum.ts 의 `FOLDER_NOT_FOUND` 패턴
- **Validate**: `npm test -- common/exceptions` — 키 lookup 통과

**Task B3**: `ShareController` + `ShareService` + `ShareRepository` + DTO
- **Action**: 4 endpoints — `POST /share-link` (auth, body: resource type/id + expiresAt) → `ShareLinkResponseDto`; `GET /share-link` (auth) → list; `GET /share-link/:token` (`@Public()`) → `PublicShareLinkResponseDto` (만료/회수 시 ErrorCode 던짐); `DELETE /share-link/:id` (auth) → 204
- **Mirror**: [trusted-device.controller.ts](../../services/api/src/trusted-device/trusted-device.controller.ts) 의 데코레이터 순서 + `@ApiError` 사용
- **Validate**: `npm test -- share` — service + repository unit 통과

**Task B4**: API e2e + Swagger codegen 동기화
- **Action**: `test/share.e2e-spec.ts` 작성 (auth 본인 토큰으로 생성 → 비로그인으로 token 조회 → 만료 시 410). codegen 재실행 → web `shared/api/__generated/` 갱신
- **Mirror**: `test/auth.e2e-spec.ts` 등 기존 e2e
- **Validate**: `npm run test:e2e -- share` + `cd services/web && npm run codegen` 후 type check

**Task B5**: web `entities/share-link` + `features/share-link-create`
- **Action**: entity (타입 + my-links query). create slice (mutation + 결과 dialog 에 토큰 URL + 복사 버튼). FileList 행 메뉴 + folder 컨텍스트 toolbar 의 트리거
- **Mirror**: `features/folder-create/` 의 dialog + 결과 표시 패턴, `features/file-search/` 의 api/model 분리
- **Validate**: `npm test -- features/share-link-create` + manual: drive 행 메뉴 → 토큰 dialog 표시 + 클립보드 복사

**Task B6**: `features/share-link-revoke` + `pages/share` 관리 페이지
- **Action**: revoke slice + 내 링크 목록 페이지 (만료/회수 상태 표시). 사이드바 "공유" 메뉴
- **Mirror**: pages/trash 의 list+action 패턴
- **Validate**: `npm test -- features/share-link-revoke` + `/share` E2E

**Task B7**: `pages/s/:token` 공개 뷰
- **Action**: 비로그인 라우트 (router 의 public path 화이트리스트에 추가). 토큰 조회 → 이미지 inline preview 또는 파일 download. 만료/회수 시 안내. axios refresh queue 우회 — 별도 client 인스턴스 사용
- **Mirror**: pages/register 의 비로그인 진입 패턴
- **Validate**: e2e: 토큰 URL 직접 진입 → 200, 만료 토큰 → 410 안내, 유효 토큰 → preview/download 동작

### C — Responsive Visual Regression (UI 안정 후)

**Task C1**: Playwright viewport projects + reduced-motion project
- **Action**: `playwright.config.ts` 에 4 viewport projects + (D7 채택 시) 5 번째 `reduced-motion` project
- **Mirror**: 기존 single-project config
- **Validate**: `npm run test:e2e -- --list` — 5 projects 노출

**Task C2**: `visual-regression.spec.ts` + auth fixture
- **Action**: 5 페이지 (login, drive, trash, settings, share-public) × 4 viewport snapshot. auth.ts fixture (로그인 헬퍼 + share-public 용 share-link 생성)
- **Mirror**: 기존 auth-flows.spec.ts 의 fixture 패턴
- **Validate**: `npm run test:e2e -- --update-snapshots e2e/visual-regression.spec.ts` 최초 1 회 (baseline 생성)

**Task C3**: baseline 검토 + CI 게이트
- **Action**: 최초 snapshot 시 mobile-ui-guide v1.1 (60/30/10 색 비율, 강조색 ≤10%) 의 시각 어휘 확인. 위반 페이지가 있으면 *snapshot 채택 전* 수정. CI workflow 추가 (별도 PR — 본 plan 범위 외 권고)
- **Validate**: `npm run test:e2e -- e2e/visual-regression.spec.ts` 재실행 시 diff 0

### 최종 — PRD sync (D8 채택 시)

**Task Z1**: PRD status 동기화
- **Action**: PRD 의 implementation phases 표에서 Phase 8 = `done`, Phase 9 = `done`, Phase 10 = `done` (본 plan 머지 시점), "Last Updated"/"Status" 줄 갱신
- **Validate**: PRD 본문 정합성 확인

---

## Validation

각 sub-area 단위 게이트 + 통합 게이트.

```bash
# Sub-area A — Device Mgmt
cd services/web && npm test -- features/device-list features/device-revoke entities/trusted-device
npm run test:e2e -- e2e/auth-flows.spec.ts

# Sub-area B — Share Link
cd services/api && npm test -- share
npm run test:e2e -- share  # API e2e
cd ../web && npm run codegen
npm test -- features/share-link-create features/share-link-revoke entities/share-link
npm run test:e2e -- e2e/share-public.spec.ts

# Sub-area C — Visual Regression
cd services/web && npm run test:e2e -- e2e/visual-regression.spec.ts

# Sub-area D — A11y
cd services/web && npm test -- --reporter=verbose 2>&1 | grep -E "(toHaveNoViolations|FAIL)"
npm run test:e2e -- e2e/a11y.spec.ts

# 통합 — 전체 회귀
cd services/web && npm run build && npm test && npm run test:e2e
cd ../api && npm run build && npm test && npm run test:e2e
```

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| share-link token 노출 시 비로그인 외부인 접근 — 권한 escalation 위험 | M | 토큰 32+ byte 무작위, 만료 검증 매 요청, refresh queue 우회 (별도 axios 인스턴스), revoked 즉시 410. security-reviewer 게이트 |
| `share_grants` (기존) 와 `share_links` (신규) 의 의미 분리가 운영자 (본인) 에게 헷갈림 | L | schema 주석 명시 + Decisions Log 에 분리 사유 박제. 향후 grant 도입 시 동일 폴더 (`src/share/`) 안에서 sub-module 로 합쳐도 무방 |
| Playwright snapshot baseline 이 OS/font fallback 차이로 CI 와 local 에서 불안정 | M | snapshot 시 `--reduced-motion=reduce` + 시스템 폰트 강제 + fontFamily fallback CSS 명시. Playwright 의 `maxDiffPixelRatio` 0.01 로 미세 차이 허용 |
| 큰 plan 으로 PR 1 개가 부피 폭주 → 리뷰 어려움 | H | sub-area 별 PR 분할 — A → D → B → C 순서로 4 PR. 본 plan 의 task 그룹이 곧 PR 단위 |
| `test-infra-axe` worktree 머지 지연 시 D1 진입 막힘 | M | D-prereq 별도 PR 우선 처리. 지연 시 본 plan task D 만 후순위, A/B/C 먼저 |
| axe-core 가 Catalyst 잔존 컴포넌트 (zinc 색) 에서 contrast violations 검출 | M | catalyst 마이그레이션은 v1.0 외 PRD ([design-system-v1](../prds/design-system-v1.prd.md)) — 본 plan 의 D1 어설션은 *마이그레이션 완료 컴포넌트만* 대상. 잔존 catalyst 컴포넌트는 별도 plan 위임 |
| 모바일 카메라/share Web API 가 Capacitor WebView 에서 차단 | L | 공유 링크 *생성*은 시스템 share sheet 가 아니라 in-app dialog + clipboard copy 로 처리 — 시스템 share 의존 없음 |
| reduced-motion baseline 추가로 CI 시간 2 배 | L | viewport 만 4 개 → 5 개 (×1.25). reduced-motion 은 1 페이지만 (drive) 으로 한정 → 실제 1.3 배 |

---

## Acceptance

본 plan 의 *모든* task 가 완료되면 다음이 동시에 성립해야 한다.

- [ ] **A — Device Management**: `/settings/devices` 에서 신뢰기기 목록 + 회수 동작. 자기 자신 기기 회수 시 즉시 재로그인 요구
- [ ] **B — Share Link**: drive 행 메뉴 → "공유 링크" → 토큰 dialog 표시 → 비로그인 다른 브라우저 에서 `/s/:token` 진입 → preview/download 성공. 회수 즉시 410
- [ ] **C — Responsive**: 5 페이지 × 4 viewport snapshot baseline 통과, diff 0
- [ ] **D — A11y**: vitest-axe 어설션 4+ 곳 + playwright-axe E2E flow 위반 0건. reduced-motion 시 motion 비활성 확인
- [ ] **PRD sync** (D8): PRD 표 stale 정리 완료
- [ ] **회귀**: `npm run build` (web+api) green, `npm test` green, `npm run test:e2e` green, `cap:android` 회귀 manual smoke
- [ ] **security-reviewer 게이트**: share-link 도메인 — 권한 escalation, 토큰 예측 불가성, 만료/회수 race 통과
- [ ] **Plan 산출물 archive**: 본 plan 의 status `pending` → `in-progress` (구현 진입) → `done` (머지) — 30 일 후 archive

---

*PRD Source*: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
*Patterns mirrored*: trusted-device (controller), folder-search/folder-create (web slices), share-grants (schema 시작점 — 의미는 분리)
*Cross-referenced worktree*: `.worktrees/test-infra-axe` (D-prereq — 별도 PR 우선)

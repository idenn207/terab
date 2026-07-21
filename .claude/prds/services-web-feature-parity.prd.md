# services/web — API Feature Parity (모바일↔PC 파일 흐름 완성)

## Problem Statement

services/api는 인증·2FA·파일/폴더/휴지통·초대·디바이스 등 15개 컨트롤러 수준으로 안정화됐지만, services/web의 파일 시스템 영역은 사실상 빈 템플릿(`pages/drive/ui/Drive.tsx` — Tom Cook 더미 데이터, 빈 main 영역) 상태다. 그 결과 1인 개발자 본인이 모바일에서 NAS를 실제로 사용·검증할 길이 없고, API 동작 확인은 매번 Swagger UI를 거쳐야 한다. 모바일 디바이스에서 2FA·업로드·다운로드 같은 사용자 흐름을 그대로 재현하는 것이 사실상 불가능해, "운영에 들어갈 수 있는지" 자체를 판정하지 못한다.

## Evidence

- API 컨트롤러 15개: `auth/login`, `twofa/{totp,backup-code,challenge,twofa}`, `trusted-device`, `device`, `user`, `invitation`, `file`, `file-upload`, `file-download`, `folder`, `trash`, `health`
- Web 페이지 중 파일 시스템 영역은 `pages/drive/ui/Drive.tsx` 단 1개 — 정적 Tailwind 템플릿으로, 실제 API 호출이나 파일 목록 표시는 없음 (`services/web/src/pages/drive/ui/Drive.tsx:33-193`)
- 인증/2FA 흐름은 `features/login-by-credentials`, `features/login-by-2fa`, `features/backup-code`, `features/trusted-device` 등에서 이미 패턴화되어 동작 — 파일/폴더/휴지통/초대 도메인은 동일 패턴 미적용
- 현재 브랜치(`test/services-web-usecase-coverage`)와 직전 커밋(`docs: services/web 테스트 커버리지 PRD/Plan 신설`)은 web 테스트 커버리지에 초점 — 이 PRD는 그 PRD를 *대체*하지 않고, 기능 구현 측면을 보완한다 (관계는 Open Questions 참조)

## Proposed Solution

이미 갖춰진 web 인프라(FSD · hey-api codegen · TanStack Query · Zustand · Catalyst UI · axios refresh queue · Capacitor Android)를 그대로 활용해, **MVP 한 줄 시나리오**("모바일에서 사진 1장 업로드 → PC 웹에서 미리보기 + 다운로드")가 완전히 동작할 때까지 도메인을 단계적으로 채운다. 직접 새 API/통신 레이어를 설계하지 않고, 2FA·BackupCode 도메인에서 검증된 슬라이스 구조(`api/` wrapper → `model/` hook → `ui/` component)를 그대로 미러링한다. 단, 디자인 방향 결정과 컴포넌트 정리는 기능 구현보다 **선행 phase**로 분리해, 디자인 결정이 흔들려도 기능 구현 견적이 무너지지 않도록 한다.

## Key Hypothesis

We believe **Must 3 도메인(invitation 발급, 모바일 파일 업로드, 파일 목록/미리보기/다운로드)을 모바일-퍼스트 디자인으로 web에 구현하는 것**이
**"모바일↔PC 양방향 NAS 파일 흐름을 본인이 실제로 사용·검증할 수 있게"** 해서
**모바일↔PC를 오가는 1인 개발자 본인**의 문제를 해결할 것이다.

We'll know we're right when:

1. 모바일 브라우저(또는 Capacitor Android 앱)에서 사진 1장을 업로드하고, 같은 세션에서 PC 웹의 드라이브 목록에 5초 이내 노출 + 인라인 미리보기 + 다운로드가 모두 성공한다
2. 정의된 사용자 UseCase 시나리오(개수 TBD — Phase 1에서 확정)를 모두 통과한다
3. 1주일 일상 사용 동안 Swagger UI를 단 한 번도 켜지 않는다

## What We're NOT Building

- **iOS Capacitor 빌드** — Android만 지원. iOS는 별도 마일스톤
- **동시 편집 / 실시간 충돌 해결** — 단일 사용자 가정. 마지막 쓰기가 이긴다
- **외부 익명 사용자 노출** — 초대받지 않은 외부인은 어떤 화면도 보지 못한다
- **최근 파일 / 즐겨찾기 / 추천** — API 미존재. v1에서는 사이드바 메뉴에서도 제거
- **검색 인덱싱 인프라** — API의 기본 검색이 충분하지 않으면 v1에서는 검색을 Should에서 후순위로 미룬다
- **데스크톱 네이티브 앱(Electron 등)** — PC는 모바일-퍼스트 반응형이 desktop breakpoint에서 자연스럽게 동작하는 형태로 충족

## Success Metrics

| Metric                 | Target                                    | How Measured                                     |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| MVP 시나리오 완주 시간 | 모바일 업로드 → PC 표시·다운로드 5초 이내 | 본인 수동 측정, Capacitor + 데스크톱 브라우저    |
| Swagger UI 의존 제거   | 1주일 운영 중 호출 0회                    | API access log 또는 본인 행동 자가 보고          |
| UseCase 시나리오 통과  | 정의된 N개(TBD, Phase 1) 100%             | Playwright E2E + 본인 수동                       |
| Capacitor Android 동작 | 핵심 3개 Must 모두 WebView에서 동작       | Android 기기 실제 검증 (`npm run cap:android`)   |
| 반응형 깨짐            | 320 / 768 / 1440 모두 overflow 0건        | Playwright screenshot diff (web/testing.md 기준) |

## Open Questions

- [ ] 디자인 방향(Editorial / Minimal / Glassmorphism 등) — Phase 1 디자인 스파이크에서 결정
- [ ] UseCase 시나리오 개수와 구체 내용 — Phase 1에서 확정, Plan 단계 input
- [ ] 기존 `services/web 테스트 커버리지 PRD/Plan`(브랜치 `test/services-web-usecase-coverage`, 직전 커밋에서 신설됐다고 표기)과의 관계 — 두 PRD가 어디서 만나고 어디서 분리되는지 명시 필요. 현재 `.claude/prds/`·`.claude/plans/` 글로브에서 찾지 못함 → 다른 경로에 있을 가능성, 또는 작업 중인 브랜치에 있을 가능성
- [ ] Capacitor WebView가 큰 파일(>100MB) 업로드/다운로드를 어떻게 처리하는지 — 기본 fetch만으로 충분한지, 네이티브 플러그인이 필요한지 (필요하면 별도 phase로 분리)
- [x] 검색 범위 — 파일명만? 메타데이터 포함? API 동작 확인 필요 — **파일명만. `GET /file/search` 의 `q` 단일 파라미터 + `scope=all|folder` (folderId 동반). 메타데이터·폴더 자체 검색은 v1+. (Phase 9 plan 결정)**
- [x] 이미지 미리보기(viewer)의 지원 포맷·이미지 외 파일(PDF/동영상) 처리 정책 — **v1 = 이미지 (`image/*`) 만 inline catalyst Dialog preview (headlessui 기반), 그 외 mime 은 자동 download fallback (Phase 4 결정)**

---

## Users & Context

### Primary User — "외출 중 모바일 본인"

- **Who**: 외부에 있는 1인 개발자 본인 (skypark207). 집에 있는 NAS에 대한 단독 운영자이자 단독 사용자
- **Current behavior**: 모바일 사진을 그때그때 클라우드에 백업하거나, Swagger UI를 열어 API를 직접 호출해 테스트. 모바일에서는 Swagger 사용 자체가 매우 불편
- **Trigger**: 외부에서 사진을 찍었고, 집 PC로 옮겨두고 싶을 때 / 집 PC에 있는 파일을 외부에서 모바일로 보고 싶을 때
- **Success state**: 모바일 한 손 조작으로 업로드 완료 → PC 브라우저를 켜자마자 갤러리에 해당 파일이 있고, 미리보기·다운로드가 즉시 가능

### Secondary User — "거실 PC 본인"

- **Who**: 같은 1인 개발자, 디바이스만 다름
- **Trigger**: 모바일로 업로드한 결과 확인, 폴더 정리, 일괄 다운로드
- **Success state**: 트리/리스트 뷰로 빠른 탐색, 다중 선택, 일괄 작업이 가능

### Job to Be Done

When **외부에서 모바일로 사진/파일을 찍거나 받았을 때**,
I want to **NAS에 빠르게 업로드하고 PC에서 확인·다운로드하기를**,
so I can **클라우드 서비스 의존 없이 내 NAS만으로 모바일↔PC 파일 흐름을 완결한다**.

### Non-Users

- **외부 익명 사용자** — 초대받지 않은 외부인. 어떠한 UI도 노출하지 않는다
- **동시 편집자** — v1은 단일 사용자 가정
- **iOS 사용자** — 별도 마일스톤
- **추천/즐겨찾기 사용자** — API에 미존재한 기능을 UI로 만들지 않는다

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability                                                            | Rationale                                                                 |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Must     | invitation 발급 (관리자 → 게스트/본인 다른 디바이스용 초대 코드 발급) | 본인 가족·다른 디바이스 등록의 시작점, RegisterForm은 이미 받는 쪽만 있음 |
| Must     | 파일 업로드 — 모바일 카메라/갤러리 진입 + 진행률 + 실패 재시도        | MVP 시나리오의 좌변, Capacitor WebView 호환 검증 포인트                   |
| Must     | 파일 목록 · 인라인 이미지 미리보기 · 다운로드                         | MVP 시나리오의 우변, Drive.tsx 템플릿을 진짜 페이지로 대체                |
| Should   | 폴더 생성·이동·삭제                                                   | 파일이 쌓이기 시작하면 즉시 필요해짐, 단 MVP 검증 자체에는 불필요         |
| Should   | 휴지통 — 복원 · 영구 삭제                                             | 데이터 손실 안전망, API 이미 존재                                         |
| Should   | 검색                                                                  | 파일이 늘면 필수가 되지만, MVP 검증에는 불필요. API 검색 범위 확인 필요   |
| Could    | 공유 링크 (API 지원 여부 확인 필요)                                   | 가족·지인 공유 시 유용하지만 본인 단일 사용 시나리오 밖                   |
| Could    | 디바이스 관리 (trusted-device 조회/해제)                              | 보안상 중요하지만 일상 사용 흐름 밖                                       |
| Won't    | 최근 파일 / 즐겨찾기                                                  | API 미존재. Drive.tsx 사이드바의 placeholder 항목 제거                    |
| Won't    | iOS Capacitor 빌드                                                    | 별도 마일스톤                                                             |
| Won't    | 동시 편집 / 실시간 협업                                               | 단일 사용자 가정                                                          |

### MVP Scope

**One-liner**: 모바일에서 사진 1장 업로드 → PC 웹의 드라이브 목록에 5초 이내 노출 + 인라인 미리보기 + 다운로드 성공

이를 위해 **반드시 필요한 슬라이스**만:

- `entities/file`, `entities/folder` (Zustand는 최소, 서버 상태는 TanStack Query 캐시)
- `features/file-upload/{api,model,ui}` — 단일 파일 업로드, 진행률
- `features/file-download/{api,model,ui}` — 다운로드 트리거
- `features/file-preview/{api,model,ui}` — 이미지 인라인 미리보기
- `widgets/drive-toolbar/` — UploadButton 등 features 조합
- `widgets/drive-layout/` — sidebar + 메인 콘텐트 (현재 Drive.tsx의 적절한 분해)
- `pages/drive/` — 위 widgets 조합으로 새 페이지 구성

### User Flow (Critical Path)

```
[모바일]
  Login (기존) → Drive 페이지
  → UploadButton 탭 (카메라 / 갤러리 선택)
  → 파일 선택 → 업로드 진행률 → 완료 토스트

[PC, 같은 계정 / 같은 세션]
  Drive 페이지 진입 → 새 파일이 목록 최상단
  → 썸네일/항목 클릭 → 인라인 미리보기
  → 다운로드 버튼 → 파일 저장 완료
```

---

## Technical Approach

**Feasibility**: HIGH

### Architecture Notes

- 신규 슬라이스는 모두 FSD 컨벤션을 따른다 — `features/file-upload`, `features/file-download`, `features/file-preview`, `features/folder-create` 등 행위 단위로 분리
- 모든 슬라이스는 `api/{query.ts,mutation.ts}` wrapper 필수 (codegen 함수 직접 import 금지). model은 `../api/...`만 import. ([services/web/CLAUDE.md "codegen 도입 후 api/ 세그먼트 규칙"](../../services/web/CLAUDE.md))
- 서버 데이터는 TanStack Query 캐시만, Zustand는 클라이언트 세션·UI 토글 전용 (web/fsd.md "State Ownership")
- 새 도메인 entity가 필요하면 `entities/file`, `entities/folder` 추가 — 서버 상태 복제 금지, 도메인 타입과 파생 store만
- Drive.tsx 같은 정적 템플릿을 페이지에 직접 두지 않는다 — `widgets/drive-layout`으로 추출 후 `pages/drive`에서 widgets 조합

### Dependencies / Integration Points

- 기존 `axiosInstance` (`shared/api/axiosInstance.ts`) — 단일 인스턴스, 401 refresh queue 그대로 사용
- 기존 `@shared/api` 진입점 — codegen 산출물 직접 경로 import 금지
- Capacitor 빌드 흐름 (`npm run cap:sync` → `cap:android`) — 기능 phase마다 Capacitor 회귀 검증 필수
- Catalyst UI — 직접 수정 금지, 래핑 컴포넌트만

### Technical Risks

| Risk                                                                                              | Likelihood | Mitigation                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| Capacitor WebView가 카메라/갤러리 picker를 표준 `<input type="file">`만으로 호환하지 않을 수 있음 | M          | Phase 3 spike에서 standard input → 안 되면 Capacitor 카메라 플러그인 도입                                   |
| 큰 파일(>100MB) 업로드 시 WebView 메모리 / 타임아웃 이슈                                          | M          | 청크 업로드(API 지원 여부 확인), 또는 작은 파일만 MVP에 한정                                                |
| 디자인 방향 미정 → 컴포넌트 재작업 비용                                                           | H          | Phase 1을 디자인 스파이크로 분리, Phase 2 이후 토큰만 바꾸면 영향 최소화되도록 컴포넌트 구조화              |
| 모바일 퍼스트 컴포넌트가 desktop에서 과도하게 단순해 보일 위험                                    | M          | 컴포넌트마다 desktop breakpoint에서 정보 밀도 증가 패턴 확보 (예: 리스트 → 그리드, 액션 메뉴 → inline 액션) |
| 검색 API 범위 부족 시 사용자 체감 부족                                                            | L          | Should 우선순위. 부족하면 v1에서 검색을 Could로 강등                                                        |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | done | admin-transferred
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Design Spike | 디자인 방향 결정, 디자인 토큰 정리, 모바일/데스크톱 컴포넌트 구조 검토, UseCase 시나리오 N개 확정 | done | - | - | [phase1-design-spike](../plans/services-web-feature-parity-phase1-design-spike.plan.md) |
| 2 | Domain Skeleton | `entities/file`, `entities/folder`, `entities/trash` 추가. drive 페이지 widgets 분해 (`widgets/drive-layout`, `widgets/drive-sidebar`) | done | - | 1 | - |
| 3 | MVP Must - Upload | `features/file-upload` 모바일 카메라/갤러리, 진행률, Capacitor 호환성 검증 | done | with 4, 5 | 2 | [phase3-mvp-must-upload](../plans/services-web-feature-parity-phase3-mvp-must-upload.plan.md) |
| 4 | MVP Must - List/Preview/Download | `features/file-preview`, `features/file-download`, `pages/drive` 목록 뷰 | done | with 3, 5 | 2 | [phase4-mvp-must-list-preview-download](../plans/services-web-feature-parity-phase4-mvp-must-list-preview-download.plan.md) |
| 5 | MVP Must - Invitation | invitation 발급 + 코드 표시 UI — **services/admin 신설로 이관 (별도 진행)**. services/web 측에는 더 이상 슬라이스 없음 | admin-transferred | - | 2 | (services/admin PRD 참조 — 별도 신설) |
| 6 | MVP Verification | MVP 시나리오 완주 검증 (모바일↔PC, Capacitor Android), UseCase E2E N개 작성. 5는 services/admin 완성 후 합류 | pending | - | 3, 4, (5: admin 완성) | - |
| 7 | Should - Folder CRUD | `features/folder-create/-rename/-move/-delete`, drive 페이지 breadcrumb + URL state | done | with 8 | 2 | [phase7-should-folder-crud](../plans/services-web-feature-parity-phase7-should-folder-crud.plan.md) + [phase7-fixup](../plans/services-web-feature-parity-phase7-fixup.plan.md) |
| 8 | Should - Trash | `features/trash-restore/purge`, 휴지통 페이지 | pending | with 7 | 2 | - |
| 9 | Should - Search | `features/file-search` — API 범위 확인 후 결정 | in-progress | - | 7, 8 | [phase9-should-search](../plans/services-web-feature-parity-phase9-should-search.plan.md) |
| 10 | Could - Polish | 공유 링크(API 확인 후), 디바이스 관리, 접근성/반응형 마무리 | in-progress | - | 9 | [phase10-could-polish](../plans/services-web-feature-parity-phase10-could-polish.plan.md) |

### Phase Details

**Phase 1: Design Spike**

- **Goal**: 디자인 방향과 모바일/데스크톱 컴포넌트 구조를 결정해, 이후 phase가 디자인 결정에 흔들리지 않는다
- **Scope**: 디자인 방향 후보 비교(Editorial / Minimal / Glassmorphism 등) → 1개 채택, `shared/styles/tokens.css` 토큰 갱신, drive 페이지 모바일/데스크톱 와이어프레임, UseCase 시나리오 N개 확정
- **Success signal**: 채택된 방향의 토큰이 적용된 sample 화면이 mobile/desktop 양쪽에서 자연스럽게 보임, UseCase 문서가 `docs/` 또는 `.claude/` 어딘가에 저장됨

**Phase 2: Domain Skeleton**

- **Goal**: 기능 phase들이 곧장 미러링할 수 있는 도메인 entity와 widget shell을 갖춘다
- **Scope**: `entities/file`, `entities/folder`, `entities/trash` 추가(타입·도메인 store 최소). Drive.tsx의 정적 마크업을 `widgets/drive-layout`/`widgets/drive-sidebar`로 분해, 더미 데이터 제거, sidebar 메뉴에서 "최근/즐겨찾기" 제거
- **Success signal**: `pages/drive`가 widgets 조합으로만 구성되고, sidebar 메뉴는 API에 존재하는 항목만 표시

**Phase 3: MVP Must - Upload**

- **Goal**: 모바일 환경에서 파일 1개를 안정적으로 업로드한다
- **Scope**: `features/file-upload/{api,model,ui}`. 단일 파일 업로드, 진행률, 실패 재시도, Capacitor 카메라/갤러리 호환성 검증
- **Success signal**: 모바일 브라우저 + Capacitor Android 양쪽에서 사진 1장 업로드 성공, 진행률 0~100% 표시

**Phase 4: MVP Must - List/Preview/Download**

- **Goal**: 업로드된 파일을 PC에서 확인·다운로드한다
- **Scope**: `features/file-preview` (이미지 인라인 viewer), `features/file-download`, `pages/drive` 목록 뷰 (반응형: 모바일 리스트 / desktop 그리드)
- **Success signal**: 업로드 직후 목록 갱신, 썸네일 클릭 시 미리보기, 다운로드 버튼으로 파일 저장
- **후속 결함**: Capacitor Android WebView 에서 anchor click 다운로드가 동작하지 않아 `@capacitor/filesystem` 분기 추가 — plan [`capacitor-android-download-fallback.plan.md`](../plans/capacitor-android-download-fallback.plan.md) (2026-05-27 done)

**Phase 5: MVP Must - Invitation (services/admin 이관)**

- **Status**: services/web 책임에서 제거. services/admin (관리자용 별도 서비스, 신설 예정) 안에서 구현된다.
- **Why moved**: invitation 발급은 관리자 행위. services/web 은 User 용이므로 발급 UI 가 user 화면에 노출되는 것은 도메인 책임 위반.
- **Original scope (이관됨)**: `features/invitation-issue/{api,model,ui}`, 발급 코드 표시·복사 UI, 만료 표시 → services/admin 의 user-management 화면에서 동일 슬라이스 구성으로 구현
- **services/web 측 변경**: `features/register-by-invitation` (수신 쪽) 만 유지 — 기존 그대로
- **Cross-reference**: services/admin 신설 PRD 가 만들어지면 그 PRD 의 invitation 발급 phase 에 연결

**Phase 6: MVP Verification**

- **Goal**: MVP 한 줄 시나리오와 UseCase 시나리오 N개를 모두 통과한다
- **Scope**: Playwright E2E 시나리오 작성, Capacitor Android 실기기 검증, 5초 이내 표시 측정, Swagger UI 의존 자가 보고
- **Depends**: Phase 3, 4 완료 (web 자체) + Phase 5 (services/admin 안에서 별도 완성). admin 미완성 시 web 자체 검증만 부분 수행 가능
- **Success signal**: MVP 시나리오 통과, UseCase N개 통과, 1주일 자가 사용 중 Swagger 미사용

**Phase 7: Should - Folder CRUD**

- **Goal**: 폴더 단위 정리·이동·이름변경이 가능하고, drive 페이지가 폴더 경로를 보존한다
- **Scope**: `features/folder-create/-rename/-move/-delete` 4개 features 슬라이스 + `widgets/drive-breadcrumb` 신설 + `pages/drive` URL search param (`?folderId=`) state + `widgets/file-list` 폴더 섹션 추가
- **Includes rename**: PRD 본문 원안에는 명시 안 됐지만 API 에 PATCH `/folders/:id` 가 있고, 폴더가 늘기 시작하면 rename 없이는 정리 불가. CRUD 4개를 한 phase 로 묶는다 (Decisions Log 참조)
- **URL state 채택**: 폴더 컨텍스트는 URL search param 으로 보존 — 새로고침·뒤로가기·공유 자연스러움 (Decisions Log 참조)
- **Depends**: Phase 2 (Domain Skeleton) — Phase 6 의존 제거 (folder CRUD 는 MVP 검증과 무관하게 독립 진행 가능)
- **Success signal**: 폴더 생성/이름변경/이동/삭제 모두 desktop·mobile 에서 동작, breadcrumb 으로 트리 탐색 가능

**Phase 8: Should - Trash** ✓ done (2026-05-29)

- **Goal**: 삭제된 파일이 복원·영구 삭제 가능하다
- **Scope**: `features/trash-restore/purge`, 휴지통 페이지
- **Success signal**: 휴지통 목록 → 복원 / 영구 삭제 모두 동작
- **Done**: 본체 + cascade-semantics fixup 완료 — trash root semantics + `PARENT_IN_TRASH` 가드 (Decisions Log 참조)

**Phase 9: Should - Search**

- **Goal**: 파일명 또는 메타데이터 기반 검색이 동작한다 (API 범위 확인 후)
- **Scope**: `features/file-search/{api,model,ui}`, drive 페이지 헤더 검색 입력
- **Success signal**: 부분 일치 검색 결과 노출, 200ms 이내 디바운스

**Phase 10: Could - Polish**

- **Goal**: 공유 링크·디바이스 관리·접근성·반응형을 마무리한다
- **Scope**: 공유 링크(API 지원 여부 확인 후), `features/device-management` (trusted-device 조회/해제), 320/768/1024/1440 반응형 회귀
- **Success signal**: web/testing.md 기준 visual regression 통과, 접근성 자동 검사 통과

### Parallelism Notes

- 1인 개발자의 phase는 *논리적 독립성*이지 *시간적 동시성*이 아니다. "with"는 phase 간 의존이 없으니 컨텍스트 스위칭 비용 없이 임의 순서·임의 분할로 진행 가능하다는 의미
- Phase 3 / 4 는 Phase 2 위에서 독립적으로 진행 가능 (2026-05-27 시점에 둘 다 done)
- Phase 5 는 services/admin 으로 이관됐으므로 web 측 작업과 시간적으로 완전 분리됨
- Phase 6 (MVP 검증) 은 web 의 3/4 + admin 의 5 완성 후 합류
- Phase 7 / 8 은 서로 독립이며 Phase 2 위에서 진행 가능. Phase 6 보다 앞설 수 있음 (admin 신설 대기 시간을 활용)
- Phase 9 는 Phase 7/8 의 데이터가 있을 때 의미 있음

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
| --- | --- | --- | --- |
| 디자인 결정을 별도 phase로 분리 | Phase 1 = Design Spike | 기능 phase 중간에 디자인 결정 산재 | 디자인이 늦어져도 후행 phase 견적이 흔들리지 않음. 사용자가 명시한 선결 조건 |
| MVP 시나리오를 한 줄로 잠금 | "모바일 사진 1장 → PC 미리보기·다운로드" | 다중 파일·폴더 포함 시나리오 | 검증 가능한 최소 단위. 한 줄이면 미래 리뷰어가 1초 내 판별 |
| Drive.tsx를 widgets로 분해 | `widgets/drive-layout` + `widgets/drive-sidebar` 분리 | Drive.tsx에 그대로 누적 | FSD 컨벤션 준수, 사이드바/메인 영역이 다른 페이지에서도 재사용 가능 |
| iOS Capacitor 빌드 미포함 | Won't (v1) | 안드로이드와 동시 진행 | Capacitor iOS는 인증서·빌드 환경이 별도. 본인 디바이스가 안드로이드인 한 우선순위 낮음 |
| 최근/즐겨찾기 사이드바 항목 제거 | Won't, sidebar 메뉴에서 삭제 | placeholder 항목 유지 | API에 없는 기능을 UI에 두지 않는다. 사용자 혼란 방지 |
| 검색을 Should로 분류 | Should (Phase 9) | Must | MVP 시나리오에 검색 불필요. 데이터가 적은 초기에는 목록 스크롤로 충분 |
| 디자인 방향 채택 (Phase 1 Spike) | Editorial Minimal + Catalyst 제거 + headlessui 자체 wrap | Bento / Glassmorphism / Editorial 순수 / Catalyst 유지 | 평가표 합계 23/25 (NAS 정보 밀도 + Capacitor perf + headless 호환), 사용자 명시 지시로 Catalyst zinc 종속 해제. 자세한 근거: [docs/design/direction.md](../../docs/design/direction.md) |
| Phase 5 (invitation 발급) services/admin 이관 (2026-05-27) | services/admin 신설 시 그 안에서 구현 | services/web 에 임시 마운트 후 admin 분리 시 이동 | invitation 발급은 관리자 행위 — User 용 services/web 에 노출하면 도메인 책임 위반. 임시 마운트는 admin 분리 시 이동 비용 + 그 사이 user 혼란 발생. 별도 진행이 더 깔끔 |
| Phase 7 에 rename 포함 (2026-05-27) | folder-create / -rename / -move / -delete 4개를 한 phase 로 묶음 | rename 을 별도 후행 phase 로 분리 | API 이미 존재 (`PATCH /folders/:id`). 폴더가 늘기 시작하면 rename 없이는 정리 불가. CRUD 한 묶음이 자연스럽고 phase 분할 오버헤드 회피 |
| Phase 7 폴더 컨텍스트는 URL search param (2026-05-27) | `?folderId=<uuid>` | URL path `/drive/:folderId` / Zustand store 만 | 새로고침·뒤로가기·공유 자연스러움 + 라우터 설정 변경 최소. path 변경은 React Router 설정 변경이 따라옴 |
| Phase 7 이동 UX 는 다이얼로그만 (2026-05-27) | FolderTreePicker 다이얼로그 | 드래그앤드롭 (또는 둘 다) | 드래그앤드롭은 모바일에서 어색 + 구현 비용 큼. 다이얼로그가 모바일/PC 모두 자연스러움. v1 범위로 충분 |
| Phase 7 폴더 삭제 UX 는 confirm 다이얼로그 (2026-05-27) | 즉시 confirm | toast "되돌리기" 5초 | API 는 soft delete (휴지통이 안전망). confirm 한 단계가 충분. 되돌리기 toast 는 비용 대비 가치 작음 |
| Phase 8 fixup — Trash root 정의 (2026-05-29) | `GET /trash` 는 *부모가 휴지통이 아닌* 자식만 반환 (LEFT JOIN + `parent.soft_deleted_at IS NULL` 필터) | (a) 모든 soft-deleted 항목 반환 (b) `TrashItemDto` 에 `trashRootId`/`parentId` 노출 후 client filter | Google Drive·Dropbox 표준 — 사용자 멘탈 모델 일치. server 가 root 만 반환 = 단일 진실원. client filter 는 메모리 비효율 + 페이지네이션 깨짐. hierarchy view 가 필요해지면 그때 추가 (YAGNI) |
| Phase 8 fixup — cascade child restore/purge 거부 (2026-05-29) | `restore` / `permanentDelete` 시작부에 `isParentInTrash` 가드 → `PARENT_IN_TRASH` (400) | (a) cascade-restore — 부모 chain 함께 복원 (b) 그냥 처리 | (a) 는 *사용자가 의도하지 않은 부모/형제 subtree 가 함께 복원*되는 부작용. (b) 는 race + 중복 처리. defense-in-depth (직접 API 호출 차단) + KISS. UI 가 trash root 만 노출하므로 정상 흐름에선 발생하지 않음 |
| Phase 8 fixup — parent chain 검사 깊이 (2026-05-29) | 1단계 LEFT JOIN 만 (`immediate parent` 의 `soft_deleted_at` 비교) | 재귀 CTE 로 전체 chain | 부모가 휴지통이면 grand-parent 도 자동으로 hide (자식이 안 보이므로 호출 안 됨). 직접 API 호출 방어 시에도 1단 검사로 충분. 단순 + 빠름 |
| Phase 9 검색 범위 = 파일명만 (2026-05-29) | `GET /file/search` 의 `q` 단일 파라미터 사용 | 메타데이터(tag/태그·생성일 범위·소유자) 추가 / Elastic 도입 | API DTO 가 `q` 단일 노출 — 추가 필드는 server 작업 동반. v1 검증 가설은 "파일명만으로 Swagger 의존 제거" 이므로 파일명으로 충분. 메타데이터는 v1+ |
| Phase 9 폴더 자체 검색 v1+ 인계 (2026-05-29) | scope=folder 는 "*현재 폴더 안 파일*" 한정으로 채택, 폴더 객체 자체 검색은 v9 제외 | 폴더 검색 endpoint 신설 후 같은 슬라이스에서 통합 | API 에 폴더 검색 endpoint 없음. drive 사용자 멘탈은 *파일을 찾는다* 가 1순위, 폴더는 breadcrumb·트리 탐색으로 도달 — 검증 시나리오 충분 |
| Phase 9 URL state 채택 (2026-05-29) | `?q=…&scope=…` URL search param | Zustand store 만 / pathname 분기 (`/search/...`) | Phase 7 URL state 정책과 일관 — 새로고침·뒤로가기·공유 자연스러움. pathname 분기는 라우터 설정 변경 비용 + 기존 페이지 분기 복잡 |
| Phase 9 IME composition debounce 일시정지 (2026-05-29) | `compositionstart` 시 debounce 일시정지, `compositionend` 후 재개 | composition 무시하고 매 input 마다 debounce | 한글 조합 중 부분 토큰("ㅎㅏㄴ") 으로 API 호출되면 결과 무의미 + 네트워크 낭비. composition 종료 후 1회 발화가 사용자 의도와 일치 |

---

## Research Summary

### Market Context

- 셀프호스팅 NAS 파일 매니저(Nextcloud, Filebrowser, Seafile 등)는 데스크톱-퍼스트 출신. 모바일 사용 시 별도 네이티브 앱을 강제하는 경향
- 본 프로젝트의 차별점은 **단일 React+Capacitor 코드베이스로 모바일/PC를 동시에 커버**한다는 점 — 1인 운영 비용 최소화에 부합
- 사이드 프로젝트 NAS 사용자가 가장 자주 호소하는 통점: 모바일 사진 백업 흐름이 어색하다 / 큰 파일 업로드가 잘 끊긴다 / 미리보기가 없어 다운로드 후 확인해야 한다

### Technical Context

- web 인프라(FSD · hey-api codegen · TanStack Query · Zustand · Catalyst UI · axios refresh queue · Capacitor Android)는 이미 완성. 신규 도메인은 기존 패턴 미러링만으로 충분
- 인증·2FA·trusted-device 도메인은 이미 `features/login-by-2fa`, `features/backup-code`, `features/trusted-device`로 구현 완료 — 동일 슬라이스 구조를 file/folder/trash/invitation 도메인에 적용
- `pages/drive/ui/Drive.tsx`는 정적 Tailwind 템플릿 상태 (193 lines, 더미 데이터 "Tom Cook" 포함). 이를 widgets로 분해하는 작업이 Phase 2의 핵심
- ts-rest → Swagger/hey-api/TanStack Query 마이그레이션이 이미 완료(`docs/archive/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md`) — codegen 워크플로우와 API 컨벤션 안정

---

*Generated: 2026-05-26*
*Last Updated: 2026-05-30 — Phase 9 in-progress (구현 완료, PR 대기)*
*Status: ACTIVE — Phase 9 (Search) 구현 완료 · PR 머지 대기, Phase 6 는 admin 완성 대기*
*Open: UseCase 시나리오 개수 (Phase 6 진입 시 확정) / Capacitor 큰 파일 / services/admin PRD 신설 시점*

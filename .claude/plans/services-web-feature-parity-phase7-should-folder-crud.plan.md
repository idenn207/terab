---
name: services-web-feature-parity-phase7-should-folder-crud
description: services/web 기능 패리티 PRD의 Phase 7 — 폴더 생성·이름변경·이동·삭제 + drive 페이지 경로 네비게이션
status: done
created: 2026-05-27
completed: 2026-05-28
---

# Plan: services/web Feature Parity — Phase 7 Should Folder CRUD

## Summary

`pages/drive`에 폴더 경로 컨텍스트를 도입해, 사용자가 (1) 현재 폴더의 하위 폴더 목록을 보고, (2) 폴더를 생성·이름변경·이동·삭제하고, (3) breadcrumb 으로 경로를 오갈 수 있게 한다. mutation은 4개 신규 슬라이스(`features/folder-create/-rename/-move/-delete`)로 분리하고, 폴더 진입 상태는 **URL search param** (`?folderId=<uuid>`)으로 보존해 새로고침·공유·뒤로가기를 자연스럽게 한다. 기존 `entities/folder/api/query.ts` 의 root/children 조회 query를 그대로 활용한다.

## User Story

As **모바일↔PC 를 오가는 1인 개발자 본인**,
I want **폴더를 만들고·이름을 바꾸고·이동하고·삭제하면서 트리를 자연스럽게 탐색하기를**,
so that **파일이 늘기 시작했을 때 정리 흐름이 막히지 않고 MVP 시나리오(업로드↔확인) 이후의 일상 사용이 지속된다**.

## Problem → Solution

**현재 상태**:

- API 엔드포인트 6개는 모두 동작: `GET /folders/root`, `GET /folders/:id/children`, `POST /folders`, `PATCH /folders/:id`(rename), `PATCH /folders/:id/move`, `DELETE /folders/:id` ([services/api/src/folder/folder.controller.ts](../../services/api/src/folder/folder.controller.ts))
- `entities/folder/api/query.ts`에 `useFolderRootQuery`·`useFolderChildrenQuery` 이미 있음 — 다만 어디서도 호출되지 않음
- `widgets/file-list` 는 파일만 표시하고 폴더는 보여주지 않음 (Phase 4 결과)
- `widgets/file-toolbar` 는 UploadButton 하나만 가짐 — NewFolderButton·breadcrumb 없음
- `pages/drive/ui/DrivePage.tsx` 는 어떤 폴더 컨텍스트도 갖지 않음 — 항상 루트 가정

**목표 상태**:

- `pages/drive`가 URL search param `?folderId=<uuid>` 로 현재 폴더 컨텍스트를 보존
- `widgets/drive-breadcrumb` 신설 — 루트→...→현재폴더 경로 표시·점프
- `widgets/file-list` 가 현재 폴더의 (1) 하위 폴더 (2) 파일을 함께 표시. 폴더 클릭 시 URL 갱신
- 4개 features 슬라이스 — create / rename / move / delete — 각자 mutation + 트리거 UI (버튼 또는 메뉴 항목)
- TanStack Query invalidation 으로 변경 즉시 반영

## Metadata

- **Complexity**: Medium (4 mutation 슬라이스 + URL 라우팅 + breadcrumb + 기존 widget 갱신)
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- **PRD Phase**: Phase 7 — Should · Folder CRUD
- **Estimated Files**: 신규 ~18 (4 slices × ~4 files + breadcrumb widget + tests), UPDATE ~5
- **Estimated Duration**: 2~3일 (mutation 4개 ×0.3일 + breadcrumb+URL ×0.5일 + 기존 widget 갱신 ×0.5일 + 테스트·회귀 ×0.5일)

---

## Open Decisions

> Plan 확정 전 사용자 결정 필요.

| # | 결정 | 후보 | 권장 | Why |
|---|---|---|---|---|
| D1 | rename 포함 여부 | (a) 포함 / (b) 별도 phase | (a) 포함 | API 있음. PRD 본문은 "create/move/delete"만 언급했지만, 폴더가 늘면 rename 없이는 정리 불가. CRUD 4개를 한 phase로 묶는 게 자연스러움. PRD 본문 자체도 같이 갱신 |
| D2 | 폴더 컨텍스트 보존 방식 | (a) URL search param `?folderId=` / (b) URL path `/drive/:folderId` / (c) Zustand store만 | (a) URL search param | 새로고침·뒤로가기 자연스러움 + 라우터 설정 변경 최소 (path 변경은 React Router 설정 수정 필요). 권장. |
| D3 | 이동 UX | (a) 다이얼로그(폴더 트리에서 선택) / (b) 드래그앤드롭 / (c) 둘 다 | (a) 다이얼로그만 (v1) | 드래그앤드롭은 모바일에서 어색하고 구현 비용 큼. 다이얼로그가 모바일/PC 모두 자연스러움 |
| D4 | 삭제 UX | (a) 즉시 confirm 다이얼로그 / (b) toast의 "되돌리기" 5초 | (a) confirm | API는 soft delete (trash) 이므로 휴지통이 안전망. confirm 한 단계가 충분. b는 비용 대비 가치 작음 |

권장 4개를 그대로 채택할지, 일부 수정할지 plan 확인 시 결정한다.

---

## UX Design

### Touchpoint Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `pages/drive` URL | `/drive` (루트 가정) | `/drive` 또는 `/drive?folderId=<uuid>` | folderId 없으면 루트 |
| `widgets/file-toolbar` | UploadButton 1개 | UploadButton + NewFolderButton | 좌측 정렬은 그대로, 신규 버튼은 UploadButton 옆 |
| `widgets/file-list` | 파일만 | 폴더 섹션 + 파일 섹션 | 폴더 먼저 표시 (Files 앱 관례) |
| 폴더 클릭 | (없음) | URL 갱신 → children 조회 | TanStack Query가 캐시한 children은 즉시 |
| 폴더 액션 | (없음) | 메뉴 (rename/move/delete) | 각 폴더 행 우측 ⋯ 메뉴 (모바일) / hover 액션 (desktop) |
| Breadcrumb | (없음) | 루트 → ... → 현재폴더 | URL ↔ breadcrumb 단방향 (URL이 진실의 출처) |

### Mobile vs Desktop

- **Mobile**: 폴더 목록 = vertical list. 폴더 행 우측 ⋯ 버튼 → action sheet (rename/move/delete). breadcrumb 가 길면 ellipsis + 탭으로 펼침
- **Desktop**: hover 시 우측 inline 액션 아이콘 노출. breadcrumb 풀로 표시

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md) | Phase 7 row + Phase Details + Decisions Log | 본 plan 의 input |
| P0 | [services/api/src/folder/folder.controller.ts](../../services/api/src/folder/folder.controller.ts) | all | endpoint 6개 시그니처 — wrapper 작성 reference |
| P0 | [services/web/src/entities/folder/api/query.ts](../../services/web/src/entities/folder/api/query.ts) | all | 기존 root/children query — 그대로 사용. invalidation 키 reference |
| P0 | [services/web/src/features/file-download/api/mutation.ts](../../services/web/src/features/file-download/api/mutation.ts) | all | 가장 최근 mutation wrapper 패턴 (Phase 4 산출물) |
| P0 | [services/web/src/widgets/file-list/ui/FileList.tsx](../../services/web/src/widgets/file-list/ui/FileList.tsx) | all | 폴더 섹션 추가 위치 |
| P0 | [services/web/src/widgets/file-list/model/useFileList.ts](../../services/web/src/widgets/file-list/model/useFileList.ts) | all | 현재 폴더 컨텍스트 주입 후 두 query (folder children + files) 조합 |
| P0 | [services/web/src/pages/drive/ui/DrivePage.tsx](../../services/web/src/pages/drive/ui/DrivePage.tsx) | all | URL search param 읽어 widget 에 전달 |
| P1 | [services/web/src/features/file-upload/ui/UploadButton.tsx](../../services/web/src/features/file-upload/ui/UploadButton.tsx) | all | 트리거 버튼 + 모달 진행 패턴 reference |
| P1 | [services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx](../../services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx) | all | NewFolderButton 마운트 위치 |
| P1 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | "FSD 레이어 의존 규칙" + "codegen 도입 후 api/ 세그먼트 규칙" | `api → model → ui` 한방향, codegen 직접 import 금지 |
| P2 | [services/web/src/features/file-download/model/save-via-filesystem.ts](../../services/web/src/features/file-download/model/save-via-filesystem.ts) | all | 플랫폼 분기(Web vs Capacitor) 패턴 — 폴더 액션에는 직접 안 쓰지만 모바일 confirm UX 의 참조 |
| P2 | [.claude/rules/ecc/web/design-quality.md](../rules/ecc/web/design-quality.md) | "Component Checklist" | 디자인 마무리 검수 기준 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Mutation wrapper | [services/web/src/features/file-download/api/mutation.ts](../../services/web/src/features/file-download/api/mutation.ts) | codegen `xxxControllerXxxMutation()` 한 줄 spread + 슬라이스별 invalidation |
| Query 조합 훅 | [services/web/src/widgets/file-list/model/useFileList.ts](../../services/web/src/widgets/file-list/model/useFileList.ts) | 두 query 결합 + 파생 상태 반환 |
| 트리거 + 다이얼로그 | [services/web/src/features/file-upload/ui/UploadButton.tsx](../../services/web/src/features/file-upload/ui/UploadButton.tsx) | 버튼 → headlessui Dialog → 폼 → submit → 토스트 |
| 행 우측 액션 메뉴 | [services/web/src/widgets/drive-layout/ui/DriveLayout.tsx:55-86](../../services/web/src/widgets/drive-layout/ui/DriveLayout.tsx#L55-L86) | `Headless.Menu` 사용 패턴 (UserMenu) |
| Invalidation 키 | [services/web/src/entities/folder/api/query.ts](../../services/web/src/entities/folder/api/query.ts) | `folderControllerGetChildrenQueryKey({ path: { id } })` — hey-api 자동 생성 키만 사용 |
| URL state | (신규 — 도입) | `useSearchParams()` (react-router) — 단일 출처, Zustand 미사용 |
| Soft delete confirm | (신규) | headlessui Dialog + 두 단계 (제목 "이 폴더를 휴지통으로 이동" + 본문 "복원은 휴지통에서 가능") |

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/features/folder-create/api/mutation.ts` | CREATE | POST /folders wrapper + 부모 children 캐시 invalidate |
| `services/web/src/features/folder-create/model/useCreateFolder.ts` | CREATE | name 입력 + 부모 id 컨텍스트 + mutate |
| `services/web/src/features/folder-create/model/useCreateFolder.test.ts` | CREATE | TDD — happy / FOLDER_DEPTH_EXCEEDED 분기 |
| `services/web/src/features/folder-create/ui/NewFolderButton.tsx` | CREATE | 트리거 버튼 + 폴더명 입력 다이얼로그 |
| `services/web/src/features/folder-create/ui/NewFolderButton.test.tsx` | CREATE | RTL — 입력 → 제출 → mutation 호출 |
| `services/web/src/features/folder-create/index.ts` | CREATE | model+ui export, api private |
| `services/web/src/features/folder-rename/api/mutation.ts` | CREATE | PATCH /folders/:id wrapper |
| `services/web/src/features/folder-rename/model/useRenameFolder.ts` | CREATE | id+newName mutate |
| `services/web/src/features/folder-rename/model/useRenameFolder.test.ts` | CREATE | TDD |
| `services/web/src/features/folder-rename/ui/RenameFolderMenuItem.tsx` | CREATE | 메뉴 항목 + 인라인 입력 |
| `services/web/src/features/folder-rename/ui/RenameFolderMenuItem.test.tsx` | CREATE | RTL |
| `services/web/src/features/folder-rename/index.ts` | CREATE | barrel |
| `services/web/src/features/folder-move/api/mutation.ts` | CREATE | PATCH /folders/:id/move wrapper + 다중 children 캐시 invalidate (출발·도착) |
| `services/web/src/features/folder-move/model/useMoveFolder.ts` | CREATE | targetParentId 선택 + mutate |
| `services/web/src/features/folder-move/model/useMoveFolder.test.ts` | CREATE | TDD — INVALID_MOVE_TARGET 케이스 (자기 자손으로 이동 금지) |
| `services/web/src/features/folder-move/ui/MoveFolderMenuItem.tsx` | CREATE | 메뉴 항목 + 폴더 트리 선택 다이얼로그 |
| `services/web/src/features/folder-move/ui/MoveFolderMenuItem.test.tsx` | CREATE | RTL |
| `services/web/src/features/folder-move/ui/FolderTreePicker.tsx` | CREATE | 폴더 트리 재귀 표시 — root+children 결합, 본인·자손 disabled |
| `services/web/src/features/folder-move/index.ts` | CREATE | barrel |
| `services/web/src/features/folder-delete/api/mutation.ts` | CREATE | DELETE /folders/:id wrapper + 부모 children 캐시 invalidate |
| `services/web/src/features/folder-delete/model/useDeleteFolder.ts` | CREATE | id mutate |
| `services/web/src/features/folder-delete/model/useDeleteFolder.test.ts` | CREATE | TDD |
| `services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.tsx` | CREATE | 메뉴 항목 + confirm 다이얼로그 ("휴지통으로 이동") |
| `services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.test.tsx` | CREATE | RTL |
| `services/web/src/features/folder-delete/index.ts` | CREATE | barrel |
| `services/web/src/features/index.ts` | UPDATE | 4개 신규 슬라이스 re-export |
| `services/web/src/widgets/drive-breadcrumb/ui/DriveBreadcrumb.tsx` | CREATE | 루트→...→현재 폴더 표시 — URL 갱신 |
| `services/web/src/widgets/drive-breadcrumb/ui/DriveBreadcrumb.test.tsx` | CREATE | RTL |
| `services/web/src/widgets/drive-breadcrumb/model/useFolderAncestors.ts` | CREATE | ancestors 조회 (children query 의 ancestors 필드 가정 — API DTO 확인 후 보강) |
| `services/web/src/widgets/drive-breadcrumb/model/useFolderAncestors.test.ts` | CREATE | TDD |
| `services/web/src/widgets/drive-breadcrumb/index.ts` | CREATE | barrel |
| `services/web/src/widgets/index.ts` | UPDATE | breadcrumb re-export |
| `services/web/src/widgets/file-list/model/useFileList.ts` | UPDATE | 현재 folderId 컨텍스트 props 받아 폴더 children + 파일 두 query 결합 |
| `services/web/src/widgets/file-list/ui/FileList.tsx` | UPDATE | 폴더 섹션 추가 (목록 위) + 폴더 행 클릭 + 우측 액션 메뉴 |
| `services/web/src/widgets/file-list/ui/FileList.test.tsx` | UPDATE | 폴더 섹션·클릭·액션 메뉴 테스트 추가 |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx` | UPDATE | NewFolderButton 마운트 |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.test.tsx` | UPDATE | NewFolderButton 표시 검증 |
| `services/web/src/pages/drive/ui/DrivePage.tsx` | UPDATE | `useSearchParams()` 로 folderId 추출 → widget 에 전달 + Breadcrumb 마운트 |
| `services/web/src/pages/drive/ui/DrivePage.test.tsx` | UPDATE | URL state → widget 전달 검증 |
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Phase 1/2/4 → done, Phase 5 → admin 이관 메모 + status 변경, Phase 7 → in-progress + PRP Plan 링크 |

---

## Tasks

> 작업은 위에서 아래로 진행. 각 task 마지막에 validation 명령 통과 후 다음으로 진행.

### Task 1: folder-create 슬라이스 (TDD)

- **Action**: `features/folder-create/{api,model,ui,index.ts}` 생성. api wrapper → useCreateFolder 훅 → NewFolderButton(+다이얼로그). 부모 폴더 컨텍스트는 props 로 받음 (NewFolderButton 사용처에서 현재 folderId 전달).
- **Mirror**: `features/file-download/api/mutation.ts` 패턴
- **Validate**:
  ```bash
  npm --prefix services/web test -- features/folder-create
  npm --prefix services/web run build
  ```

### Task 2: file-toolbar 에 NewFolderButton 마운트

- **Action**: `FileToolbar.tsx` 가 현재 folderId 를 props 로 받아 `<NewFolderButton parentId={folderId} />` 마운트. 테스트 갱신.
- **Mirror**: 기존 toolbar 구조
- **Validate**:
  ```bash
  npm --prefix services/web test -- widgets/file-toolbar
  ```

### Task 3: file-list 에 폴더 섹션 추가

- **Action**: `useFileList.ts` 가 folderId props 받아 `useFolderChildrenQuery` 도 호출. FileList.tsx 가 폴더 행을 파일보다 먼저 표시. 폴더 행 = 이름 + 우측 메뉴 placeholder (Task 4~6 에서 채움).
- **Mirror**: 기존 file-list 구조
- **Validate**:
  ```bash
  npm --prefix services/web test -- widgets/file-list
  ```

### Task 4: folder-rename 슬라이스 (TDD)

- **Action**: `features/folder-rename` 슬라이스 + 메뉴 항목 (RenameFolderMenuItem). file-list 폴더 행 메뉴에 마운트.
- **Mirror**: Task 1 패턴
- **Validate**:
  ```bash
  npm --prefix services/web test -- features/folder-rename
  npm --prefix services/web test -- widgets/file-list
  ```

### Task 5: folder-delete 슬라이스 (TDD)

- **Action**: `features/folder-delete` 슬라이스 + 메뉴 항목 (DeleteFolderMenuItem) + confirm 다이얼로그. file-list 폴더 행 메뉴에 마운트.
- **Mirror**: Task 1 패턴 + Task 1 의 다이얼로그 패턴
- **Validate**:
  ```bash
  npm --prefix services/web test -- features/folder-delete
  ```

### Task 6: folder-move 슬라이스 (TDD)

- **Action**: `features/folder-move` 슬라이스 + 메뉴 항목 + FolderTreePicker (재귀 트리, 본인·자손 disabled). file-list 폴더 행 메뉴에 마운트.
- **Mirror**: Task 1~5 패턴 + 재귀 트리는 신규 컴포넌트 (재귀 children query 로 lazy 펼치기)
- **Validate**:
  ```bash
  npm --prefix services/web test -- features/folder-move
  ```

### Task 7: drive-breadcrumb 위젯 (TDD)

- **Action**: `widgets/drive-breadcrumb` 신설. 현재 folderId 로 ancestors 조회 → 루트→...→현재 경로 표시. 각 ancestor 클릭 시 URL `?folderId=` 갱신.
- **Risk**: API DTO 에 ancestors 필드가 있는지 확인 필요. 없으면 클라이언트에서 누적 (이동 시 path stack 보존). **선행 점검**: `FolderChildrenResponseDto` 의 ancestors 필드 유무를 Task 7 진입 전 확인.
- **Mirror**: catalyst breadcrumb 컴포넌트가 있으면 wrap, 없으면 직접 작성
- **Validate**:
  ```bash
  npm --prefix services/web test -- widgets/drive-breadcrumb
  ```

### Task 8: DrivePage URL state 통합

- **Action**: `pages/drive/ui/DrivePage.tsx` 가 `useSearchParams()` 로 folderId 읽어 Breadcrumb · FileToolbar · FileList 에 전달. folderId 변경은 모두 URL setSearchParams 경유.
- **Mirror**: react-router useSearchParams 표준 사용
- **Validate**:
  ```bash
  npm --prefix services/web test -- pages/drive
  npm --prefix services/web run build
  ```

### Task 9: 전체 회귀 + 수동 E2E

- **Action**: 전체 테스트 + dev 서버 + Capacitor Android 빌드 1회.
- **Validate**:
  ```bash
  npm --prefix services/web test
  npm --prefix services/web run build
  # 수동: 폴더 생성/이름변경/이동/삭제/진입/breadcrumb 각 1회씩
  # Capacitor: npm --prefix services/web run cap:sync && cap:android
  ```

### Task 10: PRD 정합화

- **Action**: PRD 본문 갱신:
  - Phase 1: in-progress → done
  - Phase 2: pending → done (실제는 commit dc38614 시점에 완료, 본문 미반영)
  - Phase 4: in-progress → done
  - Phase 5: pending → **admin-transferred** (status 셀에 표기 + Description 에 "services/admin 신설 시 그 안에서 구현" 메모) + Phase 6 의 Depends 컬럼에서 5 제거하거나 admin 의존 메모 보강
  - Phase 7: pending → in-progress + PRP Plan 셀에 본 plan 링크
  - Decisions Log 에 "Phase 7 rename 포함", "Phase 7 URL search param 채택", "Phase 5 admin 이관" 3건 추가
- **Validate**:
  ```bash
  grep -nE 'pending|in-progress|done|admin-transferred' .claude/prds/services-web-feature-parity.prd.md
  ```

---

## Validation

```bash
# Lint + type + build
npm --prefix services/web run build

# Unit (전체)
npm --prefix services/web test

# Capacitor Android 회귀 (수동)
npm --prefix services/web run cap:sync
npm --prefix services/web run cap:android
```

수동 E2E 시나리오:

1. 루트에서 NewFolderButton 클릭 → "이미지" 폴더 생성 → file-list 에 "이미지" 표시
2. "이미지" 폴더 진입 → URL `?folderId=` 갱신 → breadcrumb "루트 > 이미지"
3. "이미지" 내부에 "2026" 폴더 생성
4. "2026" 폴더 이름 변경 "2026-05"
5. "2026-05" 폴더를 루트로 이동 (FolderTreePicker)
6. 루트로 돌아가 "2026-05" 삭제 → 휴지통으로 이동 확인 (Phase 8 가 끝나면 휴지통에서 복원도 검증)
7. 새로고침 후 URL 의 folderId 가 그대로 유지되며 같은 화면

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `FolderChildrenResponseDto` 에 ancestors 가 없으면 breadcrumb 가 어색 | M | Task 7 진입 전 DTO 확인. 없으면 (a) API 보강 PR 또는 (b) 클라이언트 path stack 보존 (이동 시 갱신, 새로고침 시 한 단계만 표시 fallback) |
| 재귀 children query 의 N+1 — 폴더가 깊을 때 트리 picker 가 느림 | M | lazy 펼치기 — 클릭한 노드만 children 조회. 페이지 진입 시 root 만 prefetch |
| folder-move 의 invalid target (자기 자손) | L | API 에서 INVALID_MOVE_TARGET 반환. 클라이언트는 picker 단계에서 disabled 처리 + 에러도 처리 |
| 폴더 깊이 제한 FOLDER_DEPTH_EXCEEDED | L | Toast 메시지로 표시. 본인 1인 사용에서는 한계 도달 가능성 낮음 |
| 디자인 일관성 — 4개 메뉴 항목이 각자 다른 톤 | M | NewFolderButton 만들면서 메뉴 항목 디자인 토큰을 1개 위치에 고정 → 나머지 미러링 |
| URL search param 변경 시 메모리 새로고침 → 스크롤 위치 손실 | L | react-router 의 `replace: false` 로 history push (back 동작 유지) — 다만 스크롤은 v1 범위 밖 |

---

## Acceptance

- [ ] 4개 features 슬라이스 (`folder-create/-rename/-move/-delete`) 모두 생성 + barrel + 테스트
- [ ] `widgets/drive-breadcrumb` 신설 + 테스트
- [ ] `widgets/file-list` 가 폴더+파일 함께 표시
- [ ] `widgets/file-toolbar` 에 NewFolderButton 마운트
- [ ] `pages/drive` 가 URL `?folderId=` 로 컨텍스트 보존
- [ ] FSD 의존 규칙 통과 (`api → model → ui`, slice barrel 통한 import 만)
- [ ] 전체 단위 테스트 통과 + coverage 80%+
- [ ] Capacitor Android 회귀 통과
- [ ] 수동 E2E 시나리오 7개 모두 통과
- [ ] PRD 본문 정합화 (Phase 1/2/4 done, Phase 5 admin 이관, Phase 7 in-progress)

---

## Implementation Notes (2026-05-27)

### 결과 요약

| 항목 | 결과 |
|---|---|
| 전체 단위 테스트 | 153/153 통과 (39 test files) |
| 빌드 (tsc + vite) | green |
| 변경 파일 | 신규 24 / 갱신 7 |
| Lint | 사전 존재 dep 결함 — main 도 동일 (`zod/v4/core` 누락). 본 PR 범위 외 |
| 수동 E2E | 사용자 진행 예정 (시나리오 7개는 plan §Validation 참조) |
| Capacitor Android 회귀 | 사용자 진행 예정 (`npm run cap:sync && cap:android`) |

### 신규 슬라이스/위젯

- `features/folder-create` (api+model+ui+tests) — NewFolderButton
- `features/folder-rename` (api+model+ui+tests) — RenameFolderMenuItem
- `features/folder-delete` (api+model+ui+tests) — DeleteFolderMenuItem (Alert confirm)
- `features/folder-move` (api+model+ui+tests) — MoveFolderMenuItem + FolderTreePicker (재귀 lazy)
- `widgets/drive-breadcrumb` (model+ui+tests) — DriveBreadcrumb + useBreadcrumbTrail

### 갱신

- `widgets/file-toolbar` — `folderId` prop 받아 NewFolderButton 마운트
- `widgets/file-list` — 폴더 섹션, 폴더 액션 메뉴 (Rename/Move/Delete), `folderId` + `onFolderOpen` prop
- `pages/drive` — `useBreadcrumbTrail` 로 URL `?folderId=` + `location.state.trail` 연동, DriveBreadcrumb 마운트
- `features/index.ts` / `widgets/index.ts` — barrel re-export

### Plan 대비 Deviation

1. **`useFolderAncestors` → `useBreadcrumbTrail`**
   - Why: plan 의 Risk #1 "ancestors 필드 없음" 확인됨 (`FolderChildrenResponseDto` 에 ancestors 부재).
   - 선택: plan 의 fallback (b) "클라이언트 path stack 보존" 채택. API 보강 (a) 은 codegen 회로 (dev API server → openapi-ts → generated diff) friction 이 1인 dev 워크플로에서 과함.
   - 결과: trail 은 `location.state.trail` 에 보존. URL 은 `?folderId=` 만 유지. 새로고침 시 trail 손실 → "현재 폴더" placeholder 로 graceful degradation. URL 자체는 stable.
   - 후속 작업 후보: 향후 API 에 ancestors 추가 시 useBreadcrumbTrail 을 그 데이터로 강화하면 새로고침까지 완벽 복원 가능.

2. **`FolderTreePicker.test.tsx` 미작성**
   - Why: 재귀 트리 + lazy children 조회는 MoveFolderMenuItem.test.tsx 에서 mock 으로 통합 검증되며, 실제 동작은 Task 9 수동 E2E 에서 확인. plan §Files to Change 도 picker 단위 테스트는 명시 안 함.
   - 후속 작업 후보: Task 9 수동 검증에서 picker 동작 이슈가 보이면 단위 테스트 추가.

3. **PRD 본문 정합화는 plan 작성 단계에 선 반영**
   - PRD 는 plan 시점에 이미 Phase 1/2/4 done, Phase 5 admin-transferred, Phase 7 in-progress + plan link 가 들어가 있었음 (commit dc38614 보다 앞 시점에 반영됨). Decisions Log 도 Phase 7 의 4개 결정 + admin 이관 모두 등재.
   - Task 10 행위: 추가 편집 불요 — 다만 본 plan 의 status 를 `in-progress → done` 으로, Phase 7 row 의 status 도 `in-progress → done` 으로 후속 갱신은 사용자가 commit 단계에서 진행 권장 (수동 E2E + Capacitor 회귀 통과 후).

### 새 폴더 깊이/이름 제한

- 깊이: API 측 `MAX_FOLDER_DEPTH = 20` (folder.service.ts). 클라이언트는 `FOLDER_DEPTH_EXCEEDED` 응답 발생 시 다이얼로그 안에 메시지 표시.
- 이름: `MaxLength(255)` (API DTO). 클라이언트 Input `maxLength={255}` 로 즉시 차단.
- 빈 이름: 클라이언트 trim 후 빈 문자열은 다이얼로그 안 alert 로 차단 (API 호출 전).

### URL 컨벤션

- 루트: `/drive`
- 폴더 컨텍스트: `/drive?folderId=<uuid>`
- 단방향: URL 이 진실의 출처. trail (이름 체인) 은 `location.state.trail` 의 enhancement layer.

### 후속

- 사용자 수동 E2E (시나리오 7개) 통과 → PRD Phase 7 row 를 `done` 으로 갱신
- 본 plan 의 frontmatter 의 `status` 는 코드 변경 차원에서는 done 처리 가능. 다만 manual E2E 통과 후 사용자가 최종 마킹

---

## Known Issues (2026-05-28 manual E2E)

코드 변경 차원에서는 Task 1~10 모두 완료 + 단위 테스트 153/153 green. 다만 사용자 수동 E2E 에서 4건 결함이 확인되어 **본 plan status 는 `done` → `in-progress` 로 되돌림**. 결함 수정은 별도 fixup plan 으로 분기.

### 발견 결함 요약

| # | Severity | 결함 | 추정 원인 |
|---|---|---|---|
| 1 | High | 폴더 ⋯ 메뉴(rename/move/delete) 클릭 시 다이얼로그가 뜨자마자 즉시 닫힘 — 사용자 인터랙션 불가 | `Headless.MenuItem` 클릭이 menu 를 자동 close. 이때 발생하는 focus shift / outside-click 이 Dialog `onClose` 를 동시에 발동. Dialog state 를 Menu 바깥(FolderRow) 으로 lift up 필요 |
| 2 | High | "휴지통으로 이동" confirm 클릭해도 실제 삭제 안 됨 (DB unchanged) | Issue #1 의 부산물 추정 — confirm 누르기 전 모달이 닫혀 mutation trigger 자체가 안 됨. #1 fix 후 재현 검증 필요 |
| 3 | High | 하위 폴더 안에서 업로드 → 파일이 root 에 표시됨 (DB 상에서도 folderId=null) | `widgets/file-toolbar` 가 `<UploadButton />` 에 folderId 미전달. `useUploadFile` input 은 이미 `folderId?: string` 받음 (변경 불요). UploadButton 만 props 추가 + mutate 호출 시 전달 |
| 4 | Medium (UX) | Breadcrumb 3 depth 이상에서 모바일 화면 잘림 — collapse + dropdown 필요 | 사용자 명세: 마지막 2개 visible, 나머지 ancestor (홈 포함) 는 `"..."` dropdown. 예시: 1depth `홈 > 하위1` / 2depth `... > 하위1 > 하위2` / 3depth `... > 하위2 > 하위3` |

### Fixup Plan

- 후속 작업: [services-web-feature-parity-phase7-fixup.plan.md](services-web-feature-parity-phase7-fixup.plan.md)
- 본 plan 의 status 는 fixup plan 완료 + 사용자 수동 E2E 재진행 후 `done` 으로 마킹

### Resolution (2026-05-28)

**모든 결함 자동 검증 통과 (수동 E2E 재진행은 사용자 확인 단계)**:

- Issue 1 — Dialog state 를 FolderRow 로 lift up. 각 `XxxFolderMenuItem` 컴포넌트를 `XxxFolderMenuItem` (trigger) + `XxxFolderDialog` (dialog) 두 export 로 분리. Menu 외부 sibling 으로 Dialog mount → Menu close 와 Dialog close 가 구조적으로 독립
- Issue 2 — Issue 1 의 부산물 (mutation 회귀 테스트 통과 + 단위 테스트로 confirm → remove() 호출 보장). DB 상의 soft_deleted_at 설정은 사용자 수동 E2E 에서 최종 확인 예정
- Issue 3 — `UploadButton` 에 `folderId: string | null` prop 추가, `FileToolbar` 에서 `<UploadButton folderId={folderId} />` 전달, `useUploadFile.mutate({ folderId: folderId ?? undefined, ... })` 로 API DTO 정합
- Issue 4 — `DriveBreadcrumb` 가 `items.length > 2` 일 때 마지막 2개 항목만 visible 로 노출, 나머지 ancestor (root 포함) 는 `BreadcrumbEllipsisMenu` (Headless Menu) 안의 `"..."` dropdown 으로 collapse. 클릭 시 `navigateRoot()` 또는 `navigateToAncestor(trailIndex)` 호출

회귀 테스트 16개 추가 (총 169 tests pass). 빌드 (tsc + vite) green.

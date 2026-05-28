---
name: services-web-feature-parity-phase7-fixup
description: Phase 7 (Folder CRUD) manual E2E 에서 발견된 4건 결함 일괄 수정 — 폴더 액션 다이얼로그 즉시 닫힘 / delete 미동작 / 하위폴더 업로드 root 귀착 / breadcrumb 3+ depth collapse UX
status: done
created: 2026-05-28
completed: 2026-05-28
parent: services-web-feature-parity-phase7-should-folder-crud
---

# Plan: Phase 7 Fixup — Manual E2E Findings

## Summary

2026-05-27 Phase 7 본체 구현 직후 사용자 수동 E2E 에서 4건 결함 확인 ([상위 plan 의 Known Issues 섹션](services-web-feature-parity-phase7-should-folder-crud.plan.md#known-issues-2026-05-28-manual-e2e) 참조). 본 plan 으로 일괄 수정 후 다시 수동 E2E 진행 → 통과 시 phase 7 plan / PRD Phase 7 row 를 `done` 으로 마킹.

## Problem → Solution

**현재 (2026-05-27 직후)**:

- Phase 7 본체 코드 변경 + 단위 테스트 153/153 통과 + 빌드 green
- 그러나 수동 E2E 에서 4건 결함 확인 — 일부는 critical UX 차단 (Issue 1, 3), 일부는 부산물 의심 (Issue 2), 1건은 모바일 UX 마무리 (Issue 4)

**목표**:

- 4건 결함 모두 해결 + 회귀 단위 테스트 보강
- Phase 7 수동 E2E 시나리오 7개 재진행 → 통과
- 본체 plan status `in-progress → done`, PRD Phase 7 row `in-progress → done`

## Metadata

- **Complexity**: Small~Medium — Issue 1/4 가 구조 리팩토링 (Dialog state lift / Breadcrumb collapse), Issue 3 은 단순 prop 전달, Issue 2 는 진단성
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md) Phase 7
- **Parent Plan**: [services-web-feature-parity-phase7-should-folder-crud.plan.md](services-web-feature-parity-phase7-should-folder-crud.plan.md)
- **Estimated Files**: UPDATE ~7 / CREATE 0~2 (collapse sub-component 1개 + 회귀 테스트 케이스)
- **Estimated Duration**: 0.5~1일

---

## Issues

### Issue 1 — 폴더 액션 메뉴 클릭 시 다이얼로그가 즉시 닫힘 (HIGH)

#### 증상

- 폴더 행 우측 ⋯ 메뉴를 열고 "이름 변경" / "이동" / "삭제" 중 하나 클릭 → 다이얼로그가 잠깐 보였다가 즉시 사라짐
- 사용자 인터랙션 (입력, 폴더 선택, confirm 클릭) 불가 → 해당 기능 차단
- 영향 범위: [RenameFolderMenuItem.tsx](../../services/web/src/features/folder-rename/ui/RenameFolderMenuItem.tsx), [MoveFolderMenuItem.tsx](../../services/web/src/features/folder-move/ui/MoveFolderMenuItem.tsx), [DeleteFolderMenuItem.tsx](../../services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.tsx)
- 영향 받지 않음: [NewFolderButton.tsx](../../services/web/src/features/folder-create/ui/NewFolderButton.tsx) (Menu 바깥에 위치)

#### 원인 분석 (추정)

- 현재 패턴: 각 menu item 컴포넌트가 자체적으로 `useState` 로 다이얼로그 open 상태를 관리. JSX 구조상 `<Headless.MenuItem>` 안의 button 이 click → setIsOpen(true) → 같은 컴포넌트 안의 `<Dialog open={isOpen} ...>` 가 열림
- Headless v2 `MenuItem` 동작: 클릭 시 menu 가 자동으로 close. 이 과정에서 focus shift / outside-click 시뮬레이션이 발생, 같은 컴포넌트 안에 portal 로 렌더된 Dialog 의 `onClose` 가 함께 트리거되는 것으로 보임
- 결과: setIsOpen(true) 직후 거의 동시에 setIsOpen(false) 가 실행 → 깜빡임만 보이고 즉시 닫힘
- 정확한 원인은 Task 1.1 진단에서 확인. DevTools breakpoint, console.log, 또는 React DevTools state inspection 으로 확인

#### 해결 후보 (Task 1.2 에서 선택)

| 후보 | 동작 | Pros | Cons |
|---|---|---|---|
| A. Dialog state lift up | FolderRow 가 modal type / target folder 상태를 owning. menu item 은 setState 만 호출. Dialog 는 menu 형제로 렌더 | 구조적 해결. 메뉴 닫힘과 Dialog open 이 독립 | FolderRow 가 3가지 modal 종류 + 폴더 컨텍스트를 갖는 작은 reducer 필요 |
| B. setTimeout 우회 | menu item click → `setTimeout(() => setIsOpen(true), 0)` | 변경 최소 | hack-ish, race condition 가능성 |
| C. Headless v2 의 `closeBehavior`/`as` 옵션 활용 | MenuItem 의 menu close 동작을 막거나 다른 element 로 래핑 | API 표준 사용 | v2 의 actual API 확인 필요, 메뉴는 닫혀야 자연스러움 |

권장: **A** — 구조적 정합. `FolderRow` 가 modal 상태를 보유하면 4개 mutation 기능을 추가/변경할 때도 단일 위치에서 관리.

#### 수정 후 회귀 테스트

- `FileList.test.tsx` 에 "폴더 메뉴 → 이름 변경 클릭 시 다이얼로그가 열려 있고 즉시 닫히지 않는다" 케이스 추가
- 각 MenuItem 컴포넌트의 unit test 는 그대로 유지 (mocked menu context 안에서 다이얼로그 open 상태 검증)

---

### Issue 2 — "휴지통으로 이동" confirm 클릭해도 실제 삭제 안 됨 (HIGH)

#### 증상

- DeleteFolderMenuItem 의 confirm 다이얼로그에서 "휴지통으로 이동" 클릭 → 시각적으로 닫힘은 발생하지만 DB 상에서 `soft_deleted_at` 미설정. 폴더가 그대로 남음

#### 원인 분석 (추정)

- Issue #1 의 부산물 가능성 높음 — 다이얼로그가 즉시 닫히는 상황에서 사용자가 "휴지통으로 이동" 을 클릭한다고 인식했지만 실제 클릭이 menu close 이벤트와 충돌하여 mutation 자체가 trigger 안 됨
- Issue #1 fix 후 재현 시 별개 결함인지 확인 필요. 가능 시나리오:
  - (a) Issue #1 의 부산물 → fix 자동 해결
  - (b) `useDeleteFolder` 의 mutation invalidation 후 DB sync 가 안 됨 (이미 단위 테스트로 path.id 전달은 확인됨)
  - (c) confirm 핸들러의 error swallow

#### 진단 단계 (Task 2.1)

1. Issue #1 fix 후 같은 시나리오 재진행
2. 여전히 삭제 안 되면:
   - Network tab 에서 `DELETE /folders/:id` 실제 호출 여부 확인
   - 호출 됐는데 200 응답인데 DB 변경 없으면 → API 측 결함 (`folderRepository.softDeleteCascade` 또는 CTE 동작)
   - 호출 자체가 안 됐으면 → confirm 버튼 핸들러 결함
   - 401/403/500 응답이면 별도 인증/서버 결함

#### 회귀 테스트

- 진단 결과에 따라 추가. (a) 시나리오면 Issue #1 회귀 테스트로 커버됨

---

### Issue 3 — 하위 폴더 안에서 업로드 → 파일이 root 에 표시됨 (HIGH)

#### 증상

- `/drive?folderId=X` 에서 업로드 → 업로드 자체는 성공하나 파일이 X 폴더가 아니라 root 에 표시됨
- DB 상에서도 `files.folder_id = null` 로 저장됨

#### 원인

- [widgets/file-toolbar/ui/FileToolbar.tsx](../../services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx) 는 이미 `folderId` prop 을 받지만 `<UploadButton />` 에는 전달하지 않음
- [features/file-upload/ui/UploadButton.tsx](../../services/web/src/features/file-upload/ui/UploadButton.tsx) 는 현재 folderId 를 받지 않으며, `useUploadFile().mutate({ file, onProgress })` 호출 시 folderId 를 누락
- [features/file-upload/model/useUploadFile.ts](../../services/web/src/features/file-upload/model/useUploadFile.ts) 의 `UploadFileInput.folderId?: string` 는 이미 옵션으로 받게 정의되어 있음 — fileUploadControllerInitMutation 의 body 에 folderId 가 그대로 전달됨

#### 수정 방향

1. `UploadButton.tsx` 에 `interface UploadButtonProps { folderId: string | null }` 추가
2. `mutate(...)` 호출 시 `folderId: folderId ?? undefined` 전달 (API DTO 는 `folderId?: string` 이므로 null 은 omit)
3. `FileToolbar.tsx` 에서 `<UploadButton folderId={folderId} />` 로 전달
4. `UploadButton.test.tsx` 에 folderId 전달 회귀 케이스 추가
5. `FileToolbar.test.tsx` 의 UploadButton mock 도 folderId 받게 갱신

#### 회귀 테스트

- `UploadButton.test.tsx`: "folderId 가 설정되면 mutate 에 folderId 가 전달된다" + "folderId=null 이면 mutate 에 folderId 가 omit 된다"
- `FileToolbar.test.tsx`: "folderId prop 이 UploadButton 에 전달된다"

---

### Issue 4 — Breadcrumb 3 depth 이상 시 collapse + dropdown UX (MEDIUM)

#### 증상

- 폴더 트리가 깊어질수록 breadcrumb 가 길어져 모바일 화면 폭을 넘김
- 현재 구현: "홈 > A > B > C > D" 처럼 모두 표시 (랩핑은 되지만 시각적으로 무겁고 가독성 저하)

#### 사용자 명세

- 마지막 2개만 visible. 나머지 ancestor (홈 포함) 는 `"..."` dropdown 안으로
- 예시:
  - **1 depth** `홈 > 하위1` (trail.length=1, items.length=2 → collapse 불요)
  - **2 depth** `... > 하위1 > 하위2` (trail.length=2, items.length=3 → "..." 안에 홈)
  - **3 depth** `... > 하위2 > 하위3` (trail.length=3, items.length=4 → "..." 안에 [홈, 하위1])
- "..." 클릭 시 dropdown 노출, 항목 클릭 시 해당 ancestor 로 navigate (root 또는 `navigateToAncestor(depth)`)

#### 알고리즘

```
let items = [{ kind: 'root' }, ...trail.map(t => ({ kind: 'ancestor', folder: t }))];
// items.length = 1 (root) or 1 + trail.length

if (items.length <= 2) {
  // 그대로 렌더 (1depth=2, 0depth=1)
} else {
  // visible = 마지막 2개, hidden = 나머지
  const visible = items.slice(-2);
  const hidden = items.slice(0, -2);
  // 렌더: <DropdownEllipsis items={hidden} /> > visible[0] > visible[1]
}
```

마지막 visible 항목이 current page 인지는 `index === trail.length - 1` 로 판단 (현재 구현과 동일).

#### 구현 방향

- `DriveBreadcrumb.tsx` 가 collapse 분기 처리
- "..." 트리거는 [shared/ui/catalyst/dropdown](../../services/web/src/shared/ui/catalyst/dropdown) 또는 Headless.Menu 로 작은 popover. 메뉴 항목 클릭 시 `navigateRoot()` (root) 또는 `navigateToAncestor(depth)` 호출
- 모바일/데스크톱 동일 동작 (사용자 명세에 환경별 분기 없음)
- "..." 자체에 `aria-label="상위 경로 펼치기"` + 키보드 접근성

#### 회귀 테스트

- `DriveBreadcrumb.test.tsx` 에 케이스 추가:
  - items 합 1개(root 만), 2개(홈+1단계): collapse 안 됨
  - items 합 3개(2단계): "..." 표시 + 안에 root, 클릭 시 navigateRoot
  - items 합 4개(3단계): "..." 표시 + 안에 [root, ancestor[0]], ancestor[0] 클릭 시 navigateToAncestor(0)
  - "..." dropdown 키보드 navigation 단순 sanity check

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/widgets/file-list/ui/FileList.tsx` | UPDATE | Issue 1 — FolderRow 가 modal state (`{ kind, folder } \| null`) 보유 + Dialog 들을 menu 바깥(또는 FolderRow 내부지만 Menu 외부 형제) 으로 옮김 |
| `services/web/src/widgets/file-list/ui/FileList.test.tsx` | UPDATE | Issue 1 회귀 — menu → 이름변경 클릭 후 다이얼로그 유지 케이스 |
| `services/web/src/features/folder-rename/ui/RenameFolderMenuItem.tsx` | UPDATE | Issue 1 — props 로 `open` / `onClose` 받게 dump component 로 분해 (또는 menu trigger 와 Dialog 를 분리). 단위 테스트는 유지 |
| `services/web/src/features/folder-move/ui/MoveFolderMenuItem.tsx` | UPDATE | Issue 1 — 동일 |
| `services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.tsx` | UPDATE | Issue 1 — 동일. Issue 2 도 본 변경의 부산물 해결 가능성 |
| `services/web/src/features/folder-rename/ui/RenameFolderMenuItem.test.tsx` | UPDATE | Issue 1 변경 후 시그니처 정합화 |
| `services/web/src/features/folder-move/ui/MoveFolderMenuItem.test.tsx` | UPDATE | 동일 |
| `services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.test.tsx` | UPDATE | 동일 |
| `services/web/src/features/file-upload/ui/UploadButton.tsx` | UPDATE | Issue 3 — `folderId` prop 받아 `mutate({ folderId: folderId ?? undefined, ... })` |
| `services/web/src/features/file-upload/ui/UploadButton.test.tsx` | UPDATE | Issue 3 회귀 — folderId 전달 검증 |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx` | UPDATE | Issue 3 — `<UploadButton folderId={folderId} />` |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.test.tsx` | UPDATE | Issue 3 회귀 — UploadButton mock 에 folderId 전달 검증 |
| `services/web/src/widgets/drive-breadcrumb/ui/DriveBreadcrumb.tsx` | UPDATE | Issue 4 — collapse + "..." dropdown 분기 |
| `services/web/src/widgets/drive-breadcrumb/ui/DriveBreadcrumb.test.tsx` | UPDATE | Issue 4 회귀 — 3 케이스 (collapse 안 됨 / 2depth / 3depth+) |

### Possibly create (Issue 1 구조 결정에 따라)

| File | Action | Why |
|---|---|---|
| `services/web/src/widgets/file-list/ui/FolderRow.tsx` | CREATE (옵션) | FolderRow 가 비대해지면 별도 컴포넌트로 분리. modal state + 3 dialogs orchestration |
| `services/web/src/widgets/file-list/model/useFolderActions.ts` | CREATE (옵션) | modal state reducer 를 model 로 추출 (FolderRow ui 가 model 사용) |
| `services/web/src/widgets/drive-breadcrumb/ui/BreadcrumbEllipsisMenu.tsx` | CREATE (옵션) | "..." dropdown 컴포넌트 분리 |

> 옵션 파일들은 작성하지 않아도 됨. 동일 파일 안에서 처리 가능하면 안 만드는 게 더 낫다. 슬라이스 깊이만 늘리지 않도록 주의.

---

## Tasks

> 위에서 아래로 진행. 각 task validation 통과 후 다음.

### Task 0 — Issue 1 진단 (선행)

- **Action**: 현재 코드를 dev 서버로 띄우고 폴더 ⋯ 메뉴 → 이름 변경 클릭. DevTools 에서 다이얼로그가 즉시 닫히는 정확한 트리거 확인:
  - 옵션 a: React DevTools 로 `isOpen` state 변화 시점 추적
  - 옵션 b: `onClose` 핸들러에 `console.trace()` 임시 삽입 → call site 확인
  - 옵션 c: Headless `<Dialog onClose>` 에 들어오는 event/원인 확인
- **결과 기록**: Task 1.2 의 해결 후보 (A/B/C) 중 어느 것을 채택할지 근거 확보
- **Validate**: 진단 결과 메모만 — 코드 변경 없음

### Task 1 — Issue 1 fix (Dialog state lift up)

- **Action**:
  - Task 0 결과에 따라 권장 A 채택: FolderRow (또는 FileList 내부의 FolderRow 함수) 가 `modal: { kind: 'rename' | 'move' | 'delete', folder: Folder } | null` 상태 보유
  - 각 menu item 컴포넌트를 두 가지 형태로 분리:
    - `RenameFolderMenuItem` → menu item 내부 click → 외부 콜백 `onOpen()` 호출만
    - `RenameFolderDialog` (또는 동일 컴포넌트 안에서 open prop 으로 분기) → `open`, `onClose`, `folder` 받아 다이얼로그 렌더
  - FolderRow 가 menu items 의 onOpen 콜백 + 다이얼로그 컴포넌트 둘 다 mount, Dialog 는 Menu 바깥의 형제 위치
- **Mirror**: 기존 `FilePreviewDialog` 가 widget 에서 mount 되고 props 만 받는 dump component 패턴
- **Validate**:
  ```bash
  cd services/web
  npx vitest run src/widgets/file-list src/features/folder-rename src/features/folder-move src/features/folder-delete
  ```
- **수동 확인**: dev 서버에서 ⋯ → 이름 변경 → 다이얼로그 유지 + 입력 가능

### Task 2 — Issue 2 검증

- **Action**: Task 1 fix 후 dev 서버에서 폴더 ⋯ → 삭제 → 휴지통으로 이동 click → DB 에서 `soft_deleted_at` 확인
- **분기**:
  - 만약 정상 동작 → Issue 2 는 Issue 1 의 부산물. close
  - 만약 여전히 안 됨 → Network tab 에서 `DELETE /folders/:id` 호출 여부 확인 후 별도 분석. API 측 검증은 [folder.repository.ts `softDeleteCascade`](../../services/api/src/folder/folder.repository.ts) 의 CTE SQL 검토
- **Validate**: 수동 — DB 에서 soft delete 확인

### Task 3 — Issue 3 fix (UploadButton folderId 전달)

- **Action**:
  - `features/file-upload/ui/UploadButton.tsx` 에 `interface UploadButtonProps { folderId: string | null }` 추가
  - `mutate({ file, folderId: folderId ?? undefined, onProgress: setProgress }, ...)` 로 변경
  - `widgets/file-toolbar/ui/FileToolbar.tsx` 에서 `<UploadButton folderId={folderId} />` 로 전달
  - UploadButton + FileToolbar 테스트 갱신:
    - UploadButton: folderId=null 일 때 mutate 에 folderId 없음 / folderId='X' 일 때 mutate 에 folderId='X'
    - FileToolbar: UploadButton mock 의 data-folder-id 검증
- **Mirror**: NewFolderButton 이 parentId 받는 패턴 (Phase 7 본체에서 도입)
- **Validate**:
  ```bash
  cd services/web
  npx vitest run src/features/file-upload src/widgets/file-toolbar
  ```
- **수동 확인**: dev 서버에서 폴더 진입 후 업로드 → 진입한 폴더에 파일 표시 (root 아님) + DB 에서 `files.folder_id` 확인

### Task 4 — Issue 4 fix (Breadcrumb collapse)

- **Action**:
  - `DriveBreadcrumb.tsx` 의 렌더링 분기:
    - `const items = [{ kind: 'root' }, ...trail.map(t => ({ kind: 'ancestor', folder: t }))];`
    - `items.length <= 2` 면 그대로 렌더 (현재 구현 유지)
    - 그 외: `<EllipsisMenu items={hidden} />` (Headless.Menu 또는 catalyst dropdown 사용) + visible 2개 렌더
  - dropdown 항목 클릭 시:
    - root 항목 → `navigateRoot()`
    - ancestor[k] → `navigateToAncestor(k)`
  - 접근성: 트리거에 `aria-label="상위 경로 펼치기"` + dropdown 안 항목은 normal MenuItem
  - 시각: 기존 ChevronRight 구분자 유지, "..." 는 텍스트 또는 `EllipsisHorizontalIcon` 사용 (FileList 메뉴 트리거와 같은 아이콘)
- **Mirror**: FileList 의 FolderRow 메뉴 (`Headless.Menu` + `MenuButton` + `MenuItems`) 패턴
- **Validate**:
  ```bash
  cd services/web
  npx vitest run src/widgets/drive-breadcrumb
  ```
- **수동 확인**: 폴더 3 depth 이상 진입 → "..." 표시 + 클릭 시 dropdown 노출 + 상위로 navigate

### Task 5 — 전체 회귀 + 수동 E2E 재실행

- **Action**:
  ```bash
  cd services/web
  npm test
  npm run build
  ```
  - Phase 7 본체 plan §Validation 의 수동 E2E 시나리오 7개 + Issue 3 회귀 (하위 폴더 업로드 → 진입한 폴더에 표시) + Issue 4 회귀 (3 depth breadcrumb)
- **Validate**: 153+ tests pass / build green / 수동 E2E 통과
- **Capacitor**: `npm run cap:sync && npm run cap:android` 1회 회귀

### Task 6 — 상위 plan / PRD status 갱신

- **Action**:
  - [services-web-feature-parity-phase7-should-folder-crud.plan.md](services-web-feature-parity-phase7-should-folder-crud.plan.md) frontmatter `status: in-progress → done` + `completed: 2026-MM-DD` 추가
  - Known Issues 섹션에 "All issues resolved (date)" 마커 추가
  - [PRD](../prds/services-web-feature-parity.prd.md) Phase 7 row `in-progress → done`
  - 본 fixup plan 의 frontmatter `status: pending → done`

---

## Validation

```bash
cd services/web

# Lint + type + build
npm run build

# Unit (전체)
npm test

# Capacitor Android 회귀 (수동)
npm run cap:sync
npm run cap:android
```

수동 E2E (Phase 7 본체 plan 의 7개 + 본 fixup 추가):

1~7. Phase 7 본체 plan §Validation 의 시나리오 7개 그대로
8. (Issue 3) 하위 폴더 안에서 업로드 → 같은 폴더에 표시 + DB 의 `files.folder_id` 가 해당 folder ID
9. (Issue 4) 3 depth 진입 → breadcrumb 가 `... > 하위2 > 하위3` 형태로 표시. "..." 클릭 → dropdown 에 [홈, 하위1] 노출. 각 항목 클릭 시 해당 위치로 navigate

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Issue 1 의 진단이 추정과 다름 (예: outside-click 이 아니라 다른 원인) | M | Task 0 진단을 별도 task 로 분리하여 잘못된 fix 진입을 사전 차단. 진단 결과를 plan §Tasks 옆에 기록 후 진행 |
| Issue 1 fix 후에도 Issue 2 가 잔존 | L | Task 2 가 진단성 task — 별개 결함이면 API 측 분석으로 분기 (CTE soft delete cascade 동작 검증) |
| Dialog state lift 가 FolderRow 복잡도 상승 → 코드 가독성 저하 | M | 옵션 파일 (FolderRow 분리 / useFolderActions 모델 분리) 활용. 다만 처음부터 분리 말고 같은 파일에서 시작, 80 lines 넘으면 분리 |
| Breadcrumb collapse dropdown 이 Issue 1 과 동일 패턴 함정 (Headless.Menu 안에서 navigate 호출) | M | dropdown 항목은 `<a>` 또는 button 으로 navigate hook 호출. Issue 1 의 fix 패턴 (또는 그 fix 가 적용된 컴포넌트 패턴) 을 정확히 따른다. dropdown 자체가 다이얼로그를 열지 않으므로 Issue 1 과 다른 시나리오 |
| API 측 결함이 Issue 2 로 식별되면 본 plan 의 범위 초과 | L | 그 경우 본 plan task 2 에서 별도 API plan 으로 분기하고 본 plan 의 Issue 2 는 "별도 plan 으로 이전" 으로 마킹 후 진행 |
| Capacitor Android 에서만 발생하는 회귀 (WebView 차이) | L | Task 5 의 Capacitor 회귀 단계에서 확인. 발생 시 별도 분석 |

---

## Acceptance

- [ ] Issue 1 — 폴더 ⋯ → rename/move/delete 클릭 시 다이얼로그가 안정적으로 열리고 사용자 입력 가능
- [ ] Issue 2 — 휴지통으로 이동 클릭 → DB 의 `folders.soft_deleted_at` 설정 + 목록에서 사라짐 (또는 별도 plan 분기)
- [ ] Issue 3 — 하위 폴더 안에서 업로드 → DB 의 `files.folder_id` 가 그 폴더 ID + UI 표시도 그 폴더 안
- [ ] Issue 4 — 3 depth 이상 breadcrumb 가 사용자 명세대로 `... > <마지막2개>` 형식 + "..." dropdown 동작
- [ ] 전체 단위 테스트 153+ 통과 (회귀 케이스 4건 이상 추가)
- [ ] 빌드 (tsc + vite) green
- [ ] Capacitor Android 회귀 통과
- [ ] 수동 E2E 시나리오 9개 모두 통과
- [ ] Phase 7 본체 plan + PRD Phase 7 row 모두 `done` 으로 갱신

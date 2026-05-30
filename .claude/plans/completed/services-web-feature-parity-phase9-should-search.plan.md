# Plan: services/web Phase 9 — Should: Search

**Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
**Selected Milestone**: Phase 9 — Should: Search
**Complexity**: Medium

## Summary

드라이브 페이지 헤더에 파일명 검색 입력을 추가해 디바운스(200ms) 된 쿼리로 `GET /file/search` 를 호출하고, 결과를 기존 파일 목록 자리에 그대로 노출한다. 검색 컨텍스트는 URL search param (`?q=…&scope=all|folder`) 으로 보존해 새로고침·뒤로가기·공유와 일관되게 동작시킨다. 폴더 자체 검색은 API endpoint 가 별도이므로 v9 범위에서 제외, v1+ 후속에 인계한다.

## Open Question 해소

| PRD Open Question | Plan 단계 결정 |
|---|---|
| 검색 범위 (파일명? 메타데이터?) | **파일명만**. `FileSearchQueryDto` 가 단일 `q` 파라미터 + `scope=all\|folder` 만 지원 (services/api/src/file/dto/file-search-query.dto.ts). 메타데이터 검색은 v1+ |
| scope='folder' 의미 | "현재 폴더 안에서만" — `folderId` 동반 필수. UI 는 toggle 로 노출 |
| 폴더 자체 검색 | v9 범위 외 (별도 endpoint 미존재) — PRD Decisions Log 에 명시 추가 |
| 페이지네이션 | API 가 미지원 → v9 도 미지원. 결과 N 건 무제한 노출 (client 200건 clip + 안내) |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Slice 골격 | `services/web/src/features/file-preview/` | `api/ + model/ + ui/ + index.ts` 4-segment |
| Query wrapper | `services/web/src/features/trusted-device/api/query.ts:4-9` | `useQuery({ ...xxxOptions(), staleTime })` 단순 wrapper |
| Form input | `services/web/src/features/login-by-credentials/` | controlled state + URL sync (RHF 미사용 — debounce·URL 일방향이 단순) |
| 슬라이스 export | `services/web/src/features/index.ts` | barrel re-export 추가 |
| Widget 합성 | `services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx:8-12` | features 의 ui 만 import, 자체 로직 없음 |
| Page composition | `services/web/src/pages/drive/ui/DrivePage.tsx:1-10` | widgets 만 import, conditional rendering |
| Test | `services/web/src/features/trusted-device/model/*.test.ts` | vitest + RTL, `*.test.tsx` 동위치 |
| URL state 정책 | Phase 7 Decisions Log (PRD) | search param 단방향 (입력 → debounce → URL → query) |
| Token | `.claude/rules/ecc/web/mobile-ui-guide.md §2.2 Text Field` | Material filled variant, 48dp hit-area, focus-visible ring |
| Debounce hook | `.claude/rules/ecc/typescript/patterns.md "Custom Hooks Pattern"` | `useDebounce<T>` template |

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/features/file-search/index.ts` | CREATE | slice barrel — `SearchInput`, `useFileSearch` 만 export |
| `services/web/src/features/file-search/api/query.ts` | CREATE | `useFileSearchQuery` codegen wrapper (`enabled = q.length >= 2`, `placeholderData: keepPreviousData`) |
| `services/web/src/features/file-search/model/useFileSearch.ts` | CREATE | URL state ↔ debounce ↔ query 결합 hook. `{ value, setValue, scope, setScope, debouncedQ, isSearching, result, isLoading }` 반환 |
| `services/web/src/features/file-search/model/useFileSearch.test.ts` | CREATE | debounce 200ms 발화·취소, URL sync, scope toggle, IME composition 일시정지, esc clear |
| `services/web/src/features/file-search/ui/SearchInput.tsx` | CREATE | inline filled input + clear button + scope toggle. `role="searchbox"`, `aria-label="파일 검색"`, esc=clear |
| `services/web/src/features/file-search/ui/SearchInput.test.tsx` | CREATE | RTL — 타이핑 / clear / 키보드 esc / scope toggle / a11y |
| `services/web/src/features/index.ts` | UPDATE | `SearchInput`, `useFileSearch` re-export 추가 |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.tsx` | UPDATE | `SearchInput` 좌측 배치 (mobile <768px: 한 줄 전체 / desktop: 좌측 flex-1) |
| `services/web/src/widgets/file-toolbar/ui/FileToolbar.test.tsx` | UPDATE | SearchInput 렌더 확인 |
| `services/web/src/pages/drive/ui/DrivePage.tsx` | UPDATE | `useFileSearch()` 의 `isSearching` true 면 `FileList` 에 검색 결과 전달, breadcrumb 숨김 |
| `services/web/src/pages/drive/ui/DrivePage.test.tsx` | UPDATE | 검색 모드 ↔ 일반 모드 전환 |
| `services/web/src/widgets/file-list/ui/FileList.tsx` | UPDATE | `mode: 'browse' \| 'search'` prop — search mode 면 folder 헤더 숨김 + 결과 0건 empty state ("일치하는 파일이 없습니다") |
| `services/web/src/widgets/file-list/ui/FileList.test.tsx` | UPDATE | mode='search' 시 empty state, mode='browse' 회귀 |
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Phase 9 행 `pending → in-progress` + Plan 셀 링크, Open Questions "검색 범위" ✅ + 결정 요약, Decisions Log 2개 추가 |

## Tasks

### Task 1 — codegen query wrapper
- **Action**: `features/file-search/api/query.ts` 에서 `fileControllerSearchOptions` 을 `useFileSearchQuery({ q, scope, folderId })` 로 wrap. 옵션:
  - `enabled: q.trim().length >= 2 && (scope !== 'folder' || !!folderId)`
  - `staleTime: 30_000`
  - `placeholderData: keepPreviousData`
- **Mirror**: `features/trusted-device/api/query.ts:4-9`
- **Validate**: `npm --prefix services/web run typecheck`

### Task 2 — debounce + URL state hook
- **Action**: `useFileSearch()` 작성.
  - `useSearchParams()` 에서 `q`, `scope` 읽기. `folderId` 는 props 또는 별도 hook 으로 받음
  - controlled `value` state 와 `debouncedQ` (200ms) 분리
  - `value` 가 200ms 안정되면 `setSearchParams({ q, scope }, { replace: true })`
  - IME composition: `compositionstart` 시 debounce 일시 정지, `compositionend` 후 재개
  - `clear()` 호출 시 input + URL param 모두 제거
  - `isSearching = debouncedQ.length >= 2`
  - `useFileSearchQuery({ q: debouncedQ, scope, folderId })` 결과 노출
- **Mirror**: typescript/patterns.md `useDebounce<T>` + Phase 7 URL state 정책 (PRD Decisions Log)
- **Validate**: `npm --prefix services/web run test -- useFileSearch`

### Task 3 — SearchInput UI
- **Action**: `features/file-search/ui/SearchInput.tsx`.
  - filled Material Text Field 톤 (mobile-ui-guide §2.2): `bg-surface-muted text-text border-border focus-visible:ring-2 focus-visible:ring-accent`
  - 좌측 search icon (lucide-react `Search`), 우측 clear button (`X`, `value.length > 0` 일 때만 노출, `aria-label="검색어 지우기"`)
  - scope toggle 두 버튼 ("전체" / "이 폴더") — `folderId === null` 일 때 "이 폴더" disabled + title "폴더 안에서만 사용 가능"
  - `role="searchbox"`, `aria-label="파일 검색"`, placeholder `"파일 검색 (2자 이상)"`, `inputMode="search"`
  - esc 키 = `clear()`, Enter 키 = 즉시 debounce 무시하고 URL 반영
  - 48dp hit-area (`min-h-12 px-4`)
- **Mirror**: catalyst 미사용. `shared/ui/input/` 있으면 활용, 없으면 inline tokens.css utility 만 사용. `cn()` 유틸 경유
- **Validate**: `npm --prefix services/web run test -- SearchInput`

### Task 4 — Toolbar 합성
- **Action**: `widgets/file-toolbar/ui/FileToolbar.tsx` 갱신.
  - mobile (<768px): `flex-col gap-3` → SearchInput 한 줄, action 들 다음 줄
  - desktop (≥768px): `md:flex-row md:items-center` → SearchInput `flex-1` 좌측, actions 우측
  - `<SearchInput folderId={folderId} />` 추가
- **Mirror**: 기존 FileToolbar.tsx 의 flex 구조 확장
- **Validate**: `npm --prefix services/web run test -- FileToolbar`

### Task 5 — DrivePage 분기
- **Action**: `pages/drive/ui/DrivePage.tsx` 갱신.
  - `useFileSearch({ folderId: currentFolderId })` 호출
  - `isSearching` true:
    - `<DriveBreadcrumb>` 숨김 (또는 "'{q}' 검색 결과" pill 로 교체)
    - `<FileList mode="search" files={searchResult ?? []} isLoading={isSearchLoading} />` 로 검색 결과 전달
  - `isSearching` false:
    - 기존 `<FileList mode="browse" folderId={currentFolderId} />` 동작 유지
- **Mirror**: `DrivePage.tsx` 의 widget 조합 패턴
- **Validate**: `npm --prefix services/web run test -- DrivePage`

### Task 6 — FileList mode prop
- **Action**: `widgets/file-list/ui/FileList.tsx` 에 `mode: 'browse' | 'search'` prop 추가.
  - `mode='search'` + `files.length === 0` + `!isLoading` → empty state "일치하는 파일이 없습니다"
  - `mode='search'` 면 folder/file 그룹 헤더 숨김 (단일 result 리스트)
  - `mode='browse'` 는 기존 동작 100% 보존
- **Mirror**: 기존 FileList 의 empty state / folder grouping 구조
- **Validate**: `npm --prefix services/web run test -- FileList`

### Task 7 — features barrel re-export
- **Action**: `services/web/src/features/index.ts` 에 `SearchInput`, `useFileSearch` 추가
- **Mirror**: 기존 barrel 패턴
- **Validate**: typecheck 통과

### Task 8 — PRD 동기화
- **Action**: `.claude/prds/services-web-feature-parity.prd.md`:
  - Phase 9 행: status `pending → in-progress`, Plan 셀 `[phase9-should-search](../plans/services-web-feature-parity-phase9-should-search.plan.md)`
  - Open Questions 의 "검색 범위" 항목 `[x]` + 결정 요약: "파일명만, `q` 단일 파라미터, `scope=all|folder` (folderId 동반). 폴더 자체 검색은 v1+"
  - Decisions Log 추가:
    - "Phase 9 검색은 파일명만 (2026-05-29): `GET /file/search` 의 `q` 단일 파라미터. 메타데이터 검색은 v1+. — API DTO 가 단일 `q` 만 노출"
    - "Phase 9 폴더 자체 검색 v1+ 인계 (2026-05-29): API endpoint 미존재. 폴더는 breadcrumb·트리 탐색으로 충분"
  - 마지막 라인 "Last Updated" / "Status" 갱신
- **Validate**: PRD diff 가 위 영역만 건드림

## Validation

```bash
# 타입 / 단위
npm --prefix services/web run typecheck
npm --prefix services/web run test -- file-search FileToolbar DrivePage FileList
npm --prefix services/web run lint

# 빌드
npm --prefix services/web run build

# 시각 회귀 (선택, Phase 6 합류 시)
#  - 모바일 320px: SearchInput 한 줄 전체, action 다음 줄
#  - desktop 1024px: SearchInput flex-1 좌측, action 우측
#  - 검색 활성 시 breadcrumb hidden, empty state 노출
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| API search 가 페이지네이션 미지원 — 결과 폭주 시 모바일 메모리 압박 | M | 클라이언트에서 `files.slice(0, 200)` clip + "결과가 너무 많습니다 — 키워드를 좁히세요" 안내. server-side limit 합의 후 제거 |
| `q.length < 2` 일 때 query 비활성 정책이 사용자 혼란 ("왜 안 뜨지") | L | input placeholder `"파일 검색 (2자 이상)"` + helper text |
| IME composition (한글 조합 중) debounce 발화로 깨진 토큰 검색 | M | `compositionstart/end` 로 debounce 일시 정지 — Task 2 의 필수 검증 항목 |
| URL state ↔ controlled input 의 순환 update | M | URL → input 은 mount / popstate 시에만 동기화, input → URL 은 debounce 후 `replaceState`. `useEffect` 의존 배열에 `value` 만 포함 |
| scope toggle 이 folderId 없는 상태에서 'folder' 선택될 위험 | L | folderId === null 이면 toggle disabled + tooltip 안내 |
| `widgets/file-toolbar` 가 모바일에서 너무 빽빽해짐 | M | mobile=세로 stack / desktop=가로 row 분기 (mobile-ui-guide §2.4) |
| codegen 함수명이 `fileControllerSearchOptions` 가 아닐 위험 | L | Task 1 시작 시 `@shared/api` barrel 에서 정확한 export 명 확인 후 wrapper 작성 |
| `keepPreviousData` 가 query 결과 stale 표시를 흐리게 함 | L | UI 에서 `isFetching` 동안 살짝 opacity 낮춤 (token motion-duration-fast) |

## Acceptance

- [ ] Task 1~8 완료, 단위 테스트 GREEN
- [ ] `q.length >= 2` 일 때만 API 호출, 200ms 미만 입력 변화에 호출 없음
- [ ] URL `?q=…&scope=…` 갱신·새로고침·뒤로가기·공유 모두 자연스러움
- [ ] IME 한글 조합 중에는 debounce 발화하지 않음
- [ ] mobile/desktop 양쪽에서 SearchInput 이 48dp touch target + focus-visible ring 통과
- [ ] FSD 규칙 준수: `api/` slice barrel 미노출, `model → api`, `ui → model` 단방향
- [ ] `cn()` + tokens.css utility 만 사용, catalyst import 0건
- [ ] PRD Phase 9 row `in-progress`, Plan 셀 갱신, Decisions Log 행 2개 추가, Open Questions "검색 범위" ✅
- [ ] `npm --prefix services/web run build` 성공


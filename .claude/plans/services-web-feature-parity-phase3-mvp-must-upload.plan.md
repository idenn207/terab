---
name: services-web-feature-parity-phase3-mvp-must-upload
description: services/web 기능 패리티 PRD 의 Phase 3 — `features/file-upload/ui` 신설 + 진행률 콜백 + complete invalidation + Capacitor 호환성 spike
status: in-progress
created: 2026-05-26
---

# Plan: services/web Feature Parity — Phase 3 MVP Must Upload

## Summary

`features/file-upload` 슬라이스의 빠진 한 조각인 **`ui/` 세그먼트**를 신설하고, 기존 `model/useUploadFile` 에 **진행률 콜백** 을 얹고, `api/mutation` 에 **complete 시 file 목록 query invalidation** 을 등록한다. UploadButton 은 `DrivePage` 의 `data-region="main"` 영역에 직접 mount 한다 (Phase 4 가 도착하면 `widgets/drive-toolbar` 로 격상). Capacitor Android WebView 가 표준 `<input type="file" accept="image/*" capture>` 만으로 카메라/갤러리 picker 를 띄울 수 있는지가 본 phase 의 spike 결과물이다.

## User Story

As **외출 중 모바일 본인**,
I want **모바일에서 사진 1장을 NAS 에 업로드하기를**,
so that **PC 에서 즉시 확인·다운로드 (Phase 4) 가 가능한 좌변 흐름이 완성되어, MVP 한 줄 시나리오의 절반이 자기검증된 상태가 된다**.

## Problem → Solution

**현재 상태**: `features/file-upload/{api,model}` 만 존재하고 `ui/` 가 비어 있다. `useUploadFile` 훅은 init → multipart PUT → complete 까지 오케스트레이션하지만 (1) 진행률을 외부에 전달하지 못하고, (2) complete 후 어떤 query 도 invalidate 하지 않는다. 또 UI 진입점 (UploadButton) 이 없어 사용자가 트리거할 방법이 없다.

**목표 상태**:
- `features/file-upload/ui/UploadButton.tsx` 신설 → `<input type="file" capture>` 트리거 + 진행률 표시 + 성공/실패 토스트
- `useUploadFile` 에 `onProgress` 콜백 추가 (uploadParts 에서 part 완료마다 누적 % 전달)
- `useUploadCompleteMutation` 에 `folderControllerGetChildren` invalidation 등록
- `DrivePage` 의 `data-region="main"` 자리에 UploadButton 1개 mount (Phase 4 가 목록/preview 채울 때 widget 으로 흡수)
- Capacitor Android 실기 검증: 카메라/갤러리 picker 가 표준 input 으로 뜨는가? → 가능 = 본 phase 종료, 불가 = Open Question 4 갱신 + 별도 phase 분리

## Metadata

- **Complexity**: Medium (slice UI 신설 + 기존 hook 시그니처 확장 + Capacitor 실기 검증)
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- **PRD Phase**: Phase 3 — MVP Must - Upload
- **Estimated Files**: 10 (CREATE 2, UPDATE 8)
- **Estimated Duration**: 1.5~2 일 (slice UI 0.5 + progress 콜백 0.25 + invalidation 0.1 + Capacitor 실기 0.5 + 테스트 0.5)

---

## UX Design

### Touchpoints

| Surface | Before | After | Notes |
|---|---|---|---|
| `/drive` 진입점 | 빈 `<section data-region="main">` | UploadButton 1개 + 진행률 영역 | Phase 4 도착 시 `widgets/drive-toolbar` 로 흡수, 본 phase 는 직접 mount |
| 모바일 picker | 없음 | `<input type="file" accept="image/*" capture="environment">` 클릭 → OS picker (카메라/갤러리 선택) | Capacitor Android WebView 호환 검증 포인트 |
| 진행률 표시 | 없음 | 0~100% 텍스트 + progressbar (`<progress>` 시멘틱 태그) | 단일 파일 기준. 5MB 단일 part 라면 사실상 0→100 점프 가능 — 그래도 표시 |
| 성공 피드백 | 없음 | "업로드 완료" 토스트 (또는 inline alert role) | 토스트 유틸 부재 시 inline `<p role="alert">` 최소 형태 |
| 실패 피드백 | 없음 | "업로드 실패: {error.message}" + 재시도 버튼 | uploadParts 의 자체 재시도 (3회) 이후 단계 실패 |

### Anti-Template Check (web/design-quality.md)

- ✋ "Default card grids" — UploadButton 은 grid 가 아니라 toolbar level 의 단일 action, 회피 OK
- ✋ "Stock hero" — 해당 없음 (drive page 본문)
- ✅ Hover/focus/active state — `shared/ui/Button` (Catalyst 기반) 그대로 활용 + Phase 1 토큰 적용
- ✅ 정보 hierarchy — 1차 액션 (Upload) 만 노출, 진행률은 progressive disclosure (실행 중일 때만 노출)
- ✅ 모바일/desktop 동등 동작 — 동일 시멘틱, breakpoint 별 padding 만 다름

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md) | Phase 3 row + Open Question 4 + Risks 표 | Phase 3 의 success signal · large-file open question · Capacitor risk 출처 |
| P0 | [services/web/src/features/file-upload/api/mutation.ts](../../services/web/src/features/file-upload/api/mutation.ts) | all | 현재 wrapper — invalidation 등록 위치. `fileUploadControllerCompleteMutation` 단일 진입점 |
| P0 | [services/web/src/features/file-upload/model/useUploadFile.ts](../../services/web/src/features/file-upload/model/useUploadFile.ts) | all | 현재 오케스트레이터. `onProgress` 콜백 시그니처 확장 대상 |
| P0 | [services/web/src/features/file-upload/model/upload-parts.ts](../../services/web/src/features/file-upload/model/upload-parts.ts) | 14-52 | part 완료마다 progress emit 지점. 동시성 4개 queue 구조 그대로 보존 |
| P0 | [services/web/src/features/file-upload/index.ts](../../services/web/src/features/file-upload/index.ts) | all | `UploadButton` re-export 추가 대상 |
| P0 | [services/web/src/pages/drive/ui/DrivePage.tsx](../../services/web/src/pages/drive/ui/DrivePage.tsx) | all | Phase 2 가 깐 region marker `data-region="main"`. UploadButton mount 지점 |
| P0 | [services/web/src/entities/file/model/types.ts](../../services/web/src/entities/file/model/types.ts) | all | **GOTCHA 출처**: `type File = FileItemDto`. upload 슬라이스에서 import 금지 (globalThis File 충돌) |
| P0 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | 22-39, 57-80, 304-400 | Widgets vs Features 판정 / codegen `api/` 세그먼트 규칙 / TanStack × Zustand 컨벤션 |
| P0 | [services/web/src/shared/api/generated/types.gen.ts](../../services/web/src/shared/api/generated/types.gen.ts) | 174-205 | `UploadInitBodyDto` / `UploadInitResponseDto` / `UploadCompletePartDto` / `UploadCompleteBodyDto` |
| P1 | [services/web/src/features/login-by-credentials/ui/LoginForm.tsx](../../services/web/src/features/login-by-credentials/ui/LoginForm.tsx) | all | 슬라이스 UI 패턴 reference — `shared/ui/` 컴포넌트 + react-hook-form / mutation hook 조합 |
| P1 | [services/web/src/features/file-upload/model/useUploadFile.test.ts](../../services/web/src/features/file-upload/model/useUploadFile.test.ts) | all | 기존 mock 패턴 — `vi.hoisted` + `mockInitMutate` / `mockCompleteMutate` / `mockUploadParts`. progress test 추가 시 동일 구조 답습 |
| P1 | [services/web/src/features/file-upload/model/upload-parts.test.ts](../../services/web/src/features/file-upload/model/upload-parts.test.ts) | all | 기존 fetch mock 패턴 — onProgress 콜백 검증 테스트 추가 시 reference |
| P1 | [services/web/src/widgets/drive-layout/ui/DriveLayout.tsx](../../services/web/src/widgets/drive-layout/ui/DriveLayout.tsx) | all | `<Outlet />` 구조 + topbar layout — UploadButton 이 DriveLayout 의 topbar 가 아닌 children 영역에 들어가는지 확인 |
| P1 | [services/web/src/shared/api/generated/@tanstack/react-query.gen.ts](../../services/web/src/shared/api/generated/@tanstack/react-query.gen.ts) | 600-625 | `folderControllerGetChildren` queryKey 자동 생성 (invalidation 대상) — `[{ _id: 'folderControllerGetChildren' }]` 매칭 부분 |
| P2 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | 402-451 | Capacitor Android 빌드 흐름 + `cap:sync` — 실기 검증 명령어 reference |
| P2 | [.claude/rules/ecc/web/design-quality.md](../rules/ecc/web/design-quality.md) | "Component Checklist" | UploadButton 4/10 quality 항목 충족 검증 |
| P2 | PR #47 — Phase 2 description | "Phase 3+ 영향" 섹션 | 도메인 File / GOTCHA / region marker 사용 가이드 박제 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `<input type="file" capture>` 표준 동작 | MDN — Web/HTML/Element/input/file#capture | `capture="environment"` 는 OS picker 에 카메라 우선 옵션. Android WebView 8.0+ 표준 지원. iOS 는 별도 |
| Capacitor 카메라 플러그인 (fallback) | capacitorjs.com/docs/apis/camera | 표준 input 미동작 시 `@capacitor/camera` 설치 → `MainActivity.java` 에 plugin 등록. 본 phase 는 spike 결과에 따라 적용 여부 결정 |
| TanStack Query invalidation 패턴 | tanstack.com/query/latest/docs/framework/react/guides/query-invalidation | hey-api codegen 의 자동 queryKey 는 `[{ _id: 'xxxControllerYyy', ...options }]` 구조. partial match 로 prefix invalidation 가능 |
| File API `slice` + 진행률 | MDN — Web/API/Blob/slice | 현재 `upload-parts.ts` 가 이미 사용. part 완료 시점에 누적 partNumber/totalParts 로 % 산출 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 슬라이스 UI 컴포넌트 | [services/web/src/features/login-by-credentials/ui/LoginForm.tsx](../../services/web/src/features/login-by-credentials/ui/LoginForm.tsx):1-60 | `function ComponentName()` 최상위 선언 + `shared/ui` 컴포넌트 import + `model/` 훅 사용 + `role="alert"` 인라인 에러 |
| `api/mutation.ts` invalidation 등록 | services/web/CLAUDE.md L370-381 ("Query Invalidation") | `useQueryClient()` + `onSuccess: () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getFiles' }] })` (본 phase 는 `'folderControllerGetChildren'`) |
| mutation hook 시그니처 확장 | 신규 (기존 reference 없음) | 옵션 객체로 `onProgress?: (percent: number) => void` 추가 — 호출자가 선택적으로 구독 |
| 테스트 mock 구조 | [services/web/src/features/file-upload/model/useUploadFile.test.ts](../../services/web/src/features/file-upload/model/useUploadFile.test.ts):6-15 | `vi.hoisted(() => ({ mock... }))` + `vi.mock('../api/mutation', () => ({ useXxxMutation: () => ({ mutateAsync: mock... }) }))` |
| 컴포넌트 테스트 (RHF + mutation) | [services/web/src/features/login-by-credentials/ui/LoginForm.test.tsx](../../services/web/src/features/login-by-credentials/ui/LoginForm.test.tsx) | 동일 슬라이스 reference — vitest + `@testing-library/react` |

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/features/file-upload/api/mutation.ts` | UPDATE | `useUploadCompleteMutation` 에 `useQueryClient` + `invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] })` 등록 |
| `services/web/src/features/file-upload/model/upload-parts.ts` | UPDATE | 함수 시그니처에 `onProgress?: (percent: number) => void` 추가. part 완료마다 `(done / total) * 100` 계산해 emit |
| `services/web/src/features/file-upload/model/useUploadFile.ts` | UPDATE | `UploadFileInput` 에 `onProgress?` 추가. `uploadParts` 호출 시 전달 + `file: globalThis.File` 명시 |
| `services/web/src/features/file-upload/ui/UploadButton.tsx` | CREATE | 본 phase 핵심. `<input type="file" accept="image/*" capture="environment">` 트리거 + 진행률 표시 + 성공/실패 alert. `useUploadFile()` 사용 |
| `services/web/src/features/file-upload/ui/UploadButton.test.tsx` | CREATE | RTL 컴포넌트 테스트 — useUploadFile mock + input change event + 진행률/완료/실패 UI 단계 검증 |
| `services/web/src/features/file-upload/index.ts` | UPDATE | `UploadButton` re-export 추가 |
| `services/web/src/features/file-upload/model/upload-parts.test.ts` | UPDATE | `onProgress` 콜백 호출 횟수/값 검증 1~2 case 추가 |
| `services/web/src/features/file-upload/model/useUploadFile.test.ts` | UPDATE | `onProgress` 전달 검증 1 case 추가 |
| `services/web/src/pages/drive/ui/DrivePage.tsx` | UPDATE | `data-region="main"` 영역에 `<UploadButton />` 1개 mount. Phase 4 가 도착하면 widget 으로 흡수 예정 |
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Phase 3 row `pending` → `in-progress` + Plan 칼럼에 본 plan 링크 |

**총 10 파일 (CREATE 2, UPDATE 8). 800 라인 제한 — UploadButton 추정 80~120 라인.**

---

## Implementation Approach

### Slice 구조 — Phase 3 종료 시점

```
features/file-upload/
  api/
    mutation.ts             UPDATE — invalidation 등록
  model/
    upload-parts.ts         UPDATE — onProgress 콜백
    upload-parts.test.ts    UPDATE — 콜백 검증 case
    useUploadFile.ts        UPDATE — onProgress 옵션 전달
    useUploadFile.test.ts   UPDATE — 옵션 전달 검증
  ui/
    UploadButton.tsx        CREATE — 핵심 산출물
    UploadButton.test.tsx   CREATE
  index.ts                  UPDATE — UploadButton re-export
```

### onProgress 시그니처

```ts
export interface UploadFileInput {
  file: globalThis.File;  // GOTCHA: 도메인 File alias 와 충돌 방지 — 명시적 globalThis.File
  folderId?: string;
  onProgress?: (percent: number) => void;  // 0~100 정수
}
```

근거: PRD 의 "진행률 0~100% 표시" 요건 + Phase 2 PR description 의 GOTCHA. `entities/file` 의 `File` alias 와 충돌하지 않도록 import 자체를 회피하고, 매개변수 위치에는 `globalThis.File` 을 명시한다.

### Capacitor 호환성 spike

1. `npm --prefix services/web run dev` → 모바일 브라우저 (실기 또는 dev tools mobile emulator) `/drive` 진입
2. UploadButton 탭 → `<input type="file" accept="image/*" capture="environment">` 가 OS picker (카메라/갤러리 선택지) 를 띄우는지 확인
3. `npm --prefix services/web run cap:sync && npm --prefix services/web run cap:android` → Capacitor Android 실기 동일 검증
4. 카메라 진입 + 사진 촬영 → 업로드 성공까지 완주
5. 결과 분류:
   - ✅ **성공** = 본 phase 종료. PRD Open Question 4 ("기본 fetch 만으로 충분") 에 "소형 파일 OK" 으로 답
   - ❌ **실패** = 별도 commit 으로 `@capacitor/camera` 도입 (`MainActivity.java` 등록 포함). 본 phase scope 확장 또는 별도 phase 분리 결정
6. **큰 파일 (>100MB)** 은 본 phase 범위 밖. Open Question 4 에 "대용량은 후속 phase 로 분리" 로 답을 좁힌다 (PRD Phase 3 success signal 은 "사진 1장")

### UploadButton 구조 (예상 80~120 라인)

```tsx
export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useUploadFile();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setProgress(0);
    mutate({ file, onProgress: setProgress }, {
      onSuccess: () => { setProgress(null); /* 토스트 */ },
      onError: (err) => { setError(err.message); setProgress(null); },
    });
    e.target.value = '';  // 동일 파일 재선택 허용
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
      <Button onClick={() => inputRef.current?.click()} disabled={isPending}>업로드</Button>
      {progress !== null && <progress value={progress} max={100} aria-label="업로드 진행률" />}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

(실제 구현 시 `shared/ui/Button` 시그니처 확인 + Catalyst props 적용. 토스트 유틸 부재 시 inline alert 유지.)

---

## Tasks

### Task 1: `api/mutation.ts` 에 invalidation 등록 (RED → GREEN)

- **Action**:
  1. `useUploadCompleteMutation` 에 `const queryClient = useQueryClient()` 추가
  2. `onSuccess` 에서 `queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] })` 호출 (partial match)
- **Mirror**: services/web/CLAUDE.md L370-381 ("Query Invalidation") 의 예시 패턴 그대로
- **Test (RED 먼저)**: `api/mutation.test.ts` 신설 — mock `useQueryClient` → complete mutation 성공 시 `invalidateQueries` 가 올바른 queryKey 로 호출되는지 검증
- **Validate**: `npm --prefix services/web test -- features/file-upload/api`

### Task 2: `upload-parts.ts` 에 `onProgress` 콜백 추가

- **Action**:
  1. 함수 시그니처: `export async function uploadParts(file, parts, headers, onProgress?: (percent: number) => void)`
  2. part 완료 시점 (현재 `results[idx] = {...}` 직후) 에 `const done = results.filter(Boolean).length; onProgress?.(Math.round((done / parts.length) * 100))` emit
  3. 동시성 race condition 주의 — `Promise.all` 끝나기 전 부분 호출 OK (단조 증가 보장은 추후 phase)
- **Test (RED 먼저)**: `upload-parts.test.ts` 에 case 추가
  - "onProgress 가 part 개수만큼 호출된다" — 3개 part 일 때 호출 횟수 ≥ 3
  - "마지막 호출은 100 이다" — 모든 part 완료 후 마지막 percent 가 100
- **Validate**: `npm --prefix services/web test -- upload-parts`

### Task 3: `useUploadFile.ts` 에 `onProgress` 옵션 전달

- **Action**:
  1. `UploadFileInput` 인터페이스에 `onProgress?: (percent: number) => void` 추가
  2. `file: File` → `file: globalThis.File` 명시 (GOTCHA 방어, 현재도 동작하지만 IDE 자동 import 사고 방지)
  3. `uploadParts(file, init.parts, init.uploadHeaders, onProgress)` — 네 번째 인자 전달
- **Test (RED 먼저)**: `useUploadFile.test.ts` 에 case 추가 — `onProgress` mock 을 mutate 인자로 넘기고 `mockUploadParts` 가 네 번째 인자로 받았는지 검증
- **Validate**: `npm --prefix services/web test -- useUploadFile`

### Task 4: `ui/UploadButton.tsx` 신설 (— Learn by Doing 후보)

- **Action**:
  1. 컴포넌트 작성 — `<input ref hidden capture>` + `<Button>` + `<progress>` + `<p role="alert">`
  2. `useRef<HTMLInputElement>` 로 hidden input 클릭 트리거
  3. `useUploadFile()` 결과의 `mutate(input, { onSuccess, onError })` 패턴
  4. `e.target.value = ''` 으로 동일 파일 재선택 허용
- **Mirror**: [LoginForm.tsx](../../services/web/src/features/login-by-credentials/ui/LoginForm.tsx) 의 `shared/ui` import + `function` 최상위 선언 + role="alert" 패턴
- **Test (RED 먼저)**: `ui/UploadButton.test.tsx`
  - "버튼 클릭 시 hidden input 의 click 이 호출된다"
  - "file 선택 시 mutate 가 호출된다 (mock useUploadFile)"
  - "isPending 동안 버튼 disabled 이다"
  - "진행률 변화 시 `<progress>` 값이 갱신된다"
  - "에러 발생 시 role=\"alert\" 메시지 노출"
- **Validate**: `npm --prefix services/web test -- UploadButton`

### Task 5: `index.ts` re-export + `DrivePage.tsx` mount

- **Action**:
  1. `features/file-upload/index.ts` 에 `export { UploadButton } from './ui/UploadButton'` 추가
  2. `features/index.ts` 가 `file-upload` re-export 하는지 확인 (없으면 추가)
  3. `pages/drive/ui/DrivePage.tsx` 의 `<section data-region="main">` 안에 `<UploadButton />` mount
- **Mirror**: Phase 2 PR description 의 region marker 사용 가이드 — `data-region="main"` 안에 mount, secondary 는 그대로 빈 자리 유지
- **Test (RED 먼저)**: `DrivePage.test.tsx` 가 이미 있는지 확인 → 없으면 신설 또는 기존 region marker 테스트 갱신 ("main region 에 UploadButton 이 렌더된다")
- **Validate**: `npm --prefix services/web test -- DrivePage` + 수동 `npm run dev` → `/drive` 진입 시 버튼 노출

### Task 6: Capacitor 실기 검증 (manual spike)

- **Action**:
  1. `npm --prefix services/web run cap:sync && npm --prefix services/web run cap:android`
  2. 실기 Android 또는 에뮬레이터에서 `/drive` 진입 → UploadButton 탭 → 카메라/갤러리 선택 picker 가 뜨는지 확인
  3. 사진 촬영 → 업로드 진행률 0→100 → 성공 alert 까지 흐름 완주
  4. 결과를 PR description 의 "Capacitor 호환성 spike" 섹션에 기록
- **Mirror**: services/web/CLAUDE.md L402-451 의 Capacitor 빌드 흐름
- **Validate**: 실기 동작 확인. 실패 시 PRD Open Question 4 갱신 + 별도 commit 으로 `@capacitor/camera` 도입 결정

### Task 7: PRD Phase 3 row 상태 갱신

- **Action**:
  1. `.claude/prds/services-web-feature-parity.prd.md` L182 — Phase 3 row 의 `Status` 컬럼 `pending` → `in-progress`
  2. `PRP Plan` 컬럼 — `-` → `[phase3-mvp-must-upload](../plans/services-web-feature-parity-phase3-mvp-must-upload.plan.md)`
- **Mirror**: Phase 2 commit `7b05b48` 의 PRD 갱신 패턴
- **Validate**: `git diff` 로 의도된 1행 변경만 확인

---

## Validation

```bash
# 슬라이스 단위 테스트 (TDD 사이클)
npm --prefix services/web test -- features/file-upload

# 전체 회귀 (Phase 2 PR 의 baseline 유지 검증)
npm --prefix services/web test

# 타입 + 빌드
npm --prefix services/web run build

# 수동 — 데스크톱 브라우저
npm --prefix services/web run dev
# → /login → /drive → UploadButton 탭 → 파일 선택 → 진행률 → 완료

# 수동 — Capacitor Android (Task 6)
npm --prefix services/web run cap:sync
npm --prefix services/web run cap:android

# grep audit — 도메인 File alias 충돌 0건 확인
grep -RIn "from '@/entities'" services/web/src/features/file-upload || echo "OK: no entities import"
grep -RIn "import.*\\bFile\\b.*from" services/web/src/features/file-upload | grep -v "globalThis.File"
# (entities 경로 import 0건 + 일반 File 토큰이 globalThis.File 외에 등장하지 않음)

# CRLF 강제
find services/web/src/features/file-upload -name "*.ts" -o -name "*.tsx" | xargs file | grep -v CRLF || echo "OK: all CRLF"
```

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Capacitor Android WebView 가 표준 `capture` 속성을 무시 → 카메라 진입 불가 | M | Task 6 spike 결과에 따라 `@capacitor/camera` 도입. 본 plan 의 success signal 은 "실기 사진 1장 업로드" 이므로 plugin 도입까지가 정상 종료 범위 |
| `folderControllerGetChildren` invalidation queryKey 형태가 hey-api 자동키와 매칭 안 됨 | L | Task 1 RED 단계에서 실제 mock 으로 검증. 매칭 안 되면 `predicate` 사용 또는 partial key 매칭 확장 |
| `onProgress` race condition 으로 단조 증가 깨짐 (40% → 30% → 70%) | M | 본 phase 는 단조 증가를 보장하지 않음. UI 측에서 `Math.max(prev, next)` 적용. Phase 6 검증 시 발견되면 별도 phase 로 분리 |
| 도메인 `File` alias 와 브라우저 `File` 충돌이 IDE 자동 import 로 재발 | M | Task 3 에서 `globalThis.File` 명시 + Validation 의 grep audit. PR description 에 GOTCHA 재명시 |
| `<progress>` 시멘틱 태그가 Catalyst 토큰과 시각적으로 어색 | L | Phase 1 토큰 (`shared/styles/tokens.css`) 적용. 보완 필요하면 별도 commit |
| `DrivePage` 에 UploadButton 직접 mount → Phase 4 가 widget 으로 격상할 때 두 번 작업 | L | 의도된 비용 (PRD 명시: "Phase 3 / 4 / 5 독립 진행"). Phase 4 도착 시 1줄 이동 |
| 큰 파일 (>100MB) 업로드 시 메모리/타임아웃 | M | 본 phase 범위 밖 — PRD Open Question 4 갱신만. Phase 6 검증에서 발견되면 별도 phase |

---

## Acceptance

- [ ] `features/file-upload/ui/UploadButton.tsx` 신설 + 슬라이스 `index.ts` 에 re-export
- [ ] `useUploadFile` / `upload-parts` 시그니처에 `onProgress` 옵션 추가 + 단위 테스트 GREEN
- [ ] `useUploadCompleteMutation` 에 `folderControllerGetChildren` invalidation 등록 + 단위 테스트 GREEN
- [ ] `DrivePage` 의 `data-region="main"` 에 UploadButton mount + 페이지 테스트 갱신
- [ ] 데스크톱 브라우저 수동 — 파일 선택 → 진행률 → 완료 alert 흐름 1회 완주
- [ ] Capacitor Android 실기 (또는 에뮬레이터) — 카메라/갤러리 picker 진입 검증. 표준 input 으로 가능하면 종료, 불가능하면 `@capacitor/camera` 도입 후 종료
- [ ] PRD Phase 3 row `pending` → `in-progress` + Plan 링크 갱신
- [ ] `npm --prefix services/web run build` 통과 (tsc + vite)
- [ ] `npm --prefix services/web test` 회귀 — Phase 2 baseline (29 PASS / 1 known FAIL) 와 동등 또는 개선
- [ ] grep audit — `entities/file` import 0건, `File` 토큰이 `globalThis.File` 외 등장 없음
- [ ] 신규 파일 모두 CRLF
- [ ] PRD Open Question 4 갱신 (Capacitor 표준 input 호환성 결과 1줄)

---

## Out of Scope (Phase 4+ 흡수)

- 파일 **목록 표시** — Phase 4 (`features/file-preview` + `pages/drive` 목록 뷰)
- 파일 **다운로드** — Phase 4 (`features/file-download`)
- **드래그앤드롭** 업로드 — Phase 7+ Polish 영역 또는 Should 확장
- **다중 파일** 업로드 / 폴더 업로드 — Phase 7+ Should
- **큰 파일 (>100MB)** 최적화 — PRD Open Question 4, 별도 phase
- **`widgets/drive-toolbar` 격상** — Phase 4 가 UploadButton + (NewFolderButton placeholder) 묶어 widget 으로 흡수
- **공유 링크** / **trusted-device** UI — Phase 10 Could

---

## References

- PRD: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- Phase 1 plan: [services-web-feature-parity-phase1-design-spike](services-web-feature-parity-phase1-design-spike.plan.md)
- Phase 2 PR: #47 — 도메인 entities + drive widgets + DrivePage 분해
- Phase 2 GOTCHA: PR #47 description "Phase 3+ 영향" 섹션
- ECC 컨벤션: [.claude/plans/README.md](README.md)

---

## Implementation Report (2026-05-26)

`/ecc:prp-implement` 로 본 plan 의 코드 작업 전체와 자동 검증을 처리한 결과. **Capacitor 실기 검증 (Task 6)** 만 사용자 수동 spike 로 남아 있어 frontmatter `status` 는 `in-progress` 로 유지한다.

### Task 결과

| # | Task | 상태 | 메모 |
|---|---|---|---|
| 1 | `api/mutation.ts` invalidation | Done | `[{ _id: 'folderControllerGetChildren' }]` partial match. `mutation.test.tsx` 신설 + GREEN |
| 2 | `upload-parts.ts` onProgress | Done | part 완료마다 `Math.round((completed / total) * 100)` emit. 신규 case 2 개 GREEN |
| 3 | `useUploadFile.ts` onProgress 전달 | Done | `UploadFileInput.file` 타입을 `globalThis.File` 로 명시 (Phase 2 GOTCHA 방어) |
| 4 | `ui/UploadButton.tsx` 신설 | Done | hidden `<input type="file" accept="image/*" capture="environment">` + Catalyst `<Button>` + 시멘틱 `<progress>` + `role="alert"`. 컴포넌트 테스트 5 case GREEN |
| 5 | `index.ts` re-export + DrivePage mount | Done | 슬라이스 barrel `UploadButton` 추가, `features/index.ts` 에 `file-upload` re-export, `DrivePage` 의 `data-region="main"` 안에 mount. DrivePage 테스트 2 case 신설 GREEN |
| 6 | Capacitor 실기 spike | **사용자 수동 대기** | `npm --prefix services/web run cap:sync && npm --prefix services/web run cap:android` → 카메라/갤러리 picker 실기 확인 필요 |
| 7 | PRD Phase 3 row 갱신 | Done | `e27aee7` plan 신설 커밋에서 이미 `pending → in-progress` + Plan 링크 적용 완료 |

### Validation Results

| Level | 결과 | 비고 |
|---|---|---|
| Type Check | Pass | `npm run build` 의 `tsc -b` 단계 통과 |
| Lint | N/A | 본 repo 는 별도 lint script 없음 (tsc strict 가 lint 역할) |
| Unit Tests | 63 / 63 PASS | 슬라이스 전용 17 + 전체 회귀 통과. Phase 2 기준 known FAIL 0 건으로 개선 |
| Build | Pass (1.29s) | `vite build` 통과. bundle 크기 변동 미미 |
| grep audit | Pass | `entities/file` import 0 건, `File` 토큰이 `globalThis.File` / `new File(...)` 외 등장 0 건 |
| CRLF | Pass | 신규/수정 파일 12 개 모두 100% CRLF |
| Capacitor 실기 | 미수행 | Task 6 사용자 수동 |

### Files Changed

| 파일 | Action | 메모 |
|---|---|---|
| `services/web/src/features/file-upload/api/mutation.ts` | UPDATE | `useQueryClient` + `onSuccess` invalidation |
| `services/web/src/features/file-upload/api/mutation.test.tsx` | CREATE | invalidate spy 검증 1 case |
| `services/web/src/features/file-upload/model/upload-parts.ts` | UPDATE | `onProgress` 콜백 + `globalThis.File` 명시 |
| `services/web/src/features/file-upload/model/upload-parts.test.ts` | UPDATE | `onProgress` 호출 횟수/마지막값 case + 미지정 호환 case |
| `services/web/src/features/file-upload/model/useUploadFile.ts` | UPDATE | `UploadFileInput.onProgress` 추가 + `uploadParts` 4 번째 인자 전달 |
| `services/web/src/features/file-upload/model/useUploadFile.test.ts` | UPDATE | 4-arg 호출로 assertion 갱신 + `onProgress` 전달 case |
| `services/web/src/features/file-upload/ui/UploadButton.tsx` | CREATE | 본 phase 핵심. 46 라인 |
| `services/web/src/features/file-upload/ui/UploadButton.test.tsx` | CREATE | RTL 5 case (클릭, mutate, isPending, alert, progressbar) |
| `services/web/src/features/file-upload/index.ts` | UPDATE | `UploadButton` re-export |
| `services/web/src/features/index.ts` | UPDATE | `export * from './file-upload'` 추가 |
| `services/web/src/pages/drive/ui/DrivePage.tsx` | UPDATE | `<UploadButton />` mount + import |
| `services/web/src/pages/drive/ui/DrivePage.test.tsx` | CREATE | region marker 2 case (main 안 UploadButton, secondary 빈 자리) |

총 12 파일 (CREATE 4 / UPDATE 8) — 추정치 (CREATE 2 / UPDATE 8) 대비 CREATE 2 건 증가 (mutation 단위 테스트 + DrivePage 페이지 테스트는 plan 텍스트에 암묵 포함이었음).

### Deviations from Plan

- **mutation.test 확장자**: plan 은 `api/mutation.test.ts`. 실제는 `api/mutation.test.tsx` 로 신설 — `<QueryClientProvider>` JSX 사용 위해 `.tsx` 가 가독성 우수. 위치/동작 동일.
- **DrivePage.test.tsx**: plan 은 "없으면 신설" 옵션. 본 구현은 신설 (기존 0 건). 2 case 추가 — main 안 UploadButton 렌더, secondary 비어있음.

### Issues Encountered

- **Fact-Forcing Gate (GateGuard)**: 본 워크트리는 모든 Bash / Write / Edit 시도에 GateGuard hook 이 facts 4 종을 요구해 진행 흐름을 늦췄지만, 변경의 명시화 효과는 있음. `ECC_GATEGUARD=off` 또는 `ECC_DISABLED_HOOKS=pre:bash:gateguard-fact-force,pre:edit-write:gateguard-fact-force` 로 우회 가능. 본 세션은 우회하지 않고 facts 명시 후 진행.
- **세션 비용 hook**: 누적 $50+ 시점부터 PostToolUse hook 이 매 tool use 마다 critical 알림. 사용자 합의로 무시 진행. 본 세션 최종 비용은 별도 보고.

### 사용자에게 남은 작업 — Task 6 (Capacitor 실기 spike)

```bash
cd .worktrees/phase3-file-upload/services/web
npm run cap:sync
npm run cap:android
```

1. 에뮬레이터 또는 실기 Android 에서 `/drive` 진입
2. UploadButton 탭 → OS picker 가 카메라/갤러리 선택지를 띄우는지 확인
3. 사진 1 장 촬영 → 진행률 0→100 → 성공 alert 까지 완주
4. 결과 분류:
   - **성공** = PRD Open Question 4 에 "기본 fetch + 표준 capture input 만으로 소형 파일 업로드 OK" 박제 + 본 plan frontmatter `status: in-progress → done` + PRD Phase 3 row `in-progress → done`
   - **실패** = `@capacitor/camera` 도입 commit 추가 후 동일 검증 + 결과 박제

### Next Steps

- Capacitor 실기 spike 완료 후 본 plan frontmatter `status: done` + PRD row `done` 갱신 → PR 작성
- 30 일 경과 후 `docs/archive/superpowers/plans/` 로 `git mv` archive (plans/README §"archive 정책")

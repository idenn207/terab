---
name: capacitor-android-download-fallback
description: services/web Phase 4 후속 결함 — Capacitor Android WebView 에서 anchor click 다운로드가 동작하지 않는 문제를 @capacitor/filesystem 분기로 해결
status: done
created: 2026-05-27
completed: 2026-05-27
---

# Plan: Capacitor Android 다운로드 fallback — `@capacitor/filesystem` 분기

## Summary

Phase 4 에서 도입한 `features/file-download/model/useDownloadFile.ts` 는 fetch → Blob → 임시 `<a download>` 클릭 패턴으로 다운로드를 트리거한다. PC 브라우저(Chrome/Edge/Firefox)에서는 정상 동작하지만, **Capacitor Android WebView 에서는 HTTP 200 + 정상 body 를 받음에도 Blob URL 을 OS 다운로드 매니저로 위임하지 않아 파일이 저장되지 않는다** (이전 세션의 실기 spike 결과로 확정). 본 plan 은 `Capacitor.isNativePlatform()` 분기로 네이티브 경로에서만 `@capacitor/filesystem` 의 `writeFile` 을 호출해 외부 저장소(scoped storage 호환 `Directory.Documents`)에 직접 저장하는 fallback 을 추가한다. 웹 경로는 변경 없음.

## Problem → Solution

**현재 상태**: `useDownloadFile.trigger(fileId, fileName)` 가 단일 경로로 anchor click 만 수행. WebView 가 download attribute 를 honor 하지 않아 모바일에서 사용자가 다운로드 버튼을 눌러도 시각/저장 피드백이 없다.

**목표 상태**:

- `Capacitor.isNativePlatform()` 가 `true` 인 경로: Blob → base64 변환 → `Filesystem.writeFile({ path, data, directory: Directory.Documents, recursive: true })` → 저장 완료 시 catalyst Alert dialog 로 "Documents 폴더에 저장되었습니다" 안내
- 그 외(웹 브라우저) 경로: 기존 anchor click 로직 그대로 유지 — 회귀 없음
- 의존성 `@capacitor/filesystem@^8` 추가 + `cap sync` 로 Android plugin 등록 동기화
- 시그니처 호환: `useDownloadFile()` 의 반환 형태(`UseDownloadFileResult`) 와 `trigger(fileId, fileName)` 시그니처 그대로 유지 → `DownloadButton.tsx` 변경 없음

## Metadata

- **Complexity**: Medium (분기 추가는 작지만 base64 변환 비용 / scoped storage 경로 / 실기 회귀 검증이 함께 묶임)
- **Source PRD**: 없음 (Phase 4 PRD `services-web-feature-parity` 의 후속 결함 처리 — plan-only)
- **Related Plan**: [`services-web-feature-parity-phase4-list-preview-download.plan.md`](services-web-feature-parity-phase4-list-preview-download.plan.md) (이번 worktree 외부에 존재할 가능성 있음 — 참조용)
- **Estimated Files**: 6 (CREATE 1 helper, UPDATE 4, dep 추가 1)
- **Estimated Duration**: 0.5~1 일 (helper 0.2 + 분기 0.1 + 테스트 0.2 + 실기 검증 0.3~0.5)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [services/web/src/features/file-download/model/useDownloadFile.ts](../../services/web/src/features/file-download/model/useDownloadFile.ts) | all | 분기 대상. 시그니처 `(fileId, fileName) => Promise<void>` 유지 |
| P0 | [services/web/src/features/file-download/model/useDownloadFile.test.ts](../../services/web/src/features/file-download/model/useDownloadFile.test.ts) | all | 기존 web 경로 회귀 테스트. native 분기 추가 시 동일 mock 패턴(`vi.hoisted` + `vi.mock`) 답습 |
| P0 | [services/web/src/features/deep-link/model/useDeepLink.ts](../../services/web/src/features/deep-link/model/useDeepLink.ts) | 1-15 | `Capacitor.isNativePlatform()` early-return 분기의 표준 사례 (이 코드베이스 컨벤션) |
| P0 | [services/web/src/features/deep-link/model/useDeepLink.test.ts](../../services/web/src/features/deep-link/model/useDeepLink.test.ts) | 1-60 | `vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn().mockReturnValue(...) } }))` 패턴 |
| P0 | [services/web/src/features/file-download/ui/DownloadButton.tsx](../../services/web/src/features/file-download/ui/DownloadButton.tsx) | all | 시그니처 호환성 확인 지점. 분기 결과를 호출처가 모르게 캡슐화 |
| P0 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | "Android / Capacitor 컨벤션" 섹션 | `cap:sync` 흐름 / Plugin 등록 위치 / `MainActivity.java` 자동 등록 (Capacitor 8 auto-registration) |
| P1 | [services/web/src/features/push-notification/model/usePushNotification.ts](../../services/web/src/features/push-notification/model/usePushNotification.ts) | 1-40 | Capacitor plugin 호출 + isNativePlatform 분기 + 비동기 효과 처리 패턴 |
| P1 | [services/web/src/features/file-download/api/mutation.ts](../../services/web/src/features/file-download/api/mutation.ts) | all | mutation 이 Blob 을 반환하는지(responseType) 확인 — base64 변환 입력 |
| P1 | [services/web/android/app/src/main/AndroidManifest.xml](../../services/web/android/app/src/main/AndroidManifest.xml) | all | 현재 `WRITE_EXTERNAL_STORAGE` 없음. `Directory.Documents` 는 app-private scoped path 라 추가 권한 불필요 — 검증 포인트 |
| P2 | [services/web/capacitor.config.ts](../../services/web/capacitor.config.ts) | all | plugin config 추가 위치 (Filesystem 은 별도 plugin config 불필요, 참고용) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `@capacitor/filesystem` API | capacitorjs.com/docs/apis/filesystem | `writeFile({ path, data: base64String, directory: Directory.Documents, recursive: true })` 가 표준. base64 prefix(`data:...;base64,`) 는 자동 제거 |
| `Directory` enum 선택 기준 | 동상 — Directory section | `Documents` = app-private + Android 13+ scoped storage 호환 + 외부에서 파일 매니저로 접근 가능. `External` = sdcard 루트(권한 필요, deprecated 방향) |
| Blob → base64 변환 | MDN — FileReader#readAsDataURL | `readAsDataURL(blob)` 후 `result.split(',')[1]` 로 prefix 제거. 또는 `Buffer.from(await blob.arrayBuffer()).toString('base64')` 대체 가능 |
| Capacitor 8 plugin auto-registration | capacitorjs.com/docs/v8/main/plugins/creating-plugins (Android) | npm install 후 `cap sync` 만으로 Java side 자동 등록. `MainActivity.java` 수동 편집 불필요 |
| Android scoped storage | developer.android.com/training/data-storage | API 30+ 강제. app-private dir + MediaStore 만 권장. `WRITE_EXTERNAL_STORAGE` 는 deprecated |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 분기 — Native 가드 | [`features/deep-link/model/useDeepLink.ts:10`](../../services/web/src/features/deep-link/model/useDeepLink.ts#L10) | `if (!Capacitor.isNativePlatform()) return;` 또는 if/else 로 양쪽 경로 분기 |
| 테스트 — Capacitor mock | [`features/deep-link/model/useDeepLink.test.ts:10`](../../services/web/src/features/deep-link/model/useDeepLink.test.ts#L10) | `vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) } }))` + 케이스마다 `mockReturnValue(false)` 토글 |
| Helper 추출 | [`features/file-upload/model/upload-parts.ts`](../../services/web/src/features/file-upload/model/upload-parts.ts) | model 내 순수 함수는 동일 디렉토리에 별도 파일로 분리, 훅과 단독 단위 테스트 |
| Mutation Blob 반환 | [`features/file-download/api/mutation.ts`](../../services/web/src/features/file-download/api/mutation.ts) | hey-api codegen mutation 의 responseType 그대로 사용 — 변경 금지 |
| 사용자 피드백 | `shared/ui/catalyst/alert/` | 토스트 시스템 부재 → catalyst `<Alert>` 로 dialog 노출 (또는 inline `<p role="alert">` 최소 형태). 본 plan 은 helper 함수만 분리하고 UI 표현은 `DownloadButton` 에 위임 |
| 파일 명명 / 함수명 | `useDownloadFile`, `useUploadFile`, `useDeepLink` | camelCase + `use` prefix. 신규 helper 는 `blob-to-base64.ts` / `save-via-filesystem.ts` 같은 kebab-case |

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/package.json` | UPDATE | `@capacitor/filesystem@^8` dependency 추가 |
| `services/web/package-lock.json` | UPDATE | 자동 갱신 (npm install 후 commit) |
| `services/web/src/features/file-download/model/blob-to-base64.ts` | CREATE | Blob → base64 string (prefix 제거) 순수 변환 헬퍼. 단독 테스트 가능하도록 분리 |
| `services/web/src/features/file-download/model/blob-to-base64.test.ts` | CREATE | 변환 테스트 — 빈 Blob, 텍스트, 바이너리 케이스 |
| `services/web/src/features/file-download/model/save-via-filesystem.ts` | CREATE | `Filesystem.writeFile` 호출 + Directory.Documents + recursive: true 로 캡슐화. 호출처는 `(fileName, blob) => Promise<{ uri: string }>` |
| `services/web/src/features/file-download/model/save-via-filesystem.test.ts` | CREATE | `vi.mock('@capacitor/filesystem')` 로 `writeFile` 호출 인자 검증 |
| `services/web/src/features/file-download/model/useDownloadFile.ts` | UPDATE | `Capacitor.isNativePlatform()` 분기 추가 — true 시 `save-via-filesystem` 경로, false 시 기존 anchor click 경로. 반환 시그니처 유지 |
| `services/web/src/features/file-download/model/useDownloadFile.test.ts` | UPDATE | (1) 기존 web 경로 테스트는 `isNativePlatform=false` 명시 / (2) `isNativePlatform=true` 분기 신규 테스트 추가 — Filesystem.writeFile 가 호출되고 anchor 가 생성되지 않음을 검증 |
| `services/web/src/features/file-download/ui/DownloadButton.tsx` | UPDATE (optional) | 저장 완료 피드백 — native 분기에서 저장 위치 안내. 시그니처 변경 없이 `onSuccess` 콜백을 받지 않고 훅 내부에서 `Alert` 띄우는 안 / 또는 훅이 결과 메시지를 반환하도록 확장 — Task 5 에서 결정 |

새 파일 모두 **CRLF** 로 저장 (Windows 개발 환경 기본값, [hookify.enforce-crlf-default](.claude/hookify.enforce-crlf-default.local.md) 자동 검증).

---

## Tasks

### Task 1 — `@capacitor/filesystem` 의존성 추가 + cap sync 검증

- **Action**:
  - `cd services/web && npm install @capacitor/filesystem@^8`
  - `npm run cap:sync` 실행 → `android/app/src/main/java/.../MainActivity.java` 가 자동 갱신되지 않더라도 Capacitor 8 auto-registration 으로 plugin 사용 가능한지 확인
  - `android/app/build.gradle` 의 dependency 블록에 `@capacitor/filesystem` 의 `capacitor-filesystem` 가 추가됐는지 확인 (cap sync 가 자동 처리)
- **Mirror**: Phase 3 에서 `@capacitor/camera` (필요 시) 또는 기존 `@capacitor/push-notifications` 도입 시 cap sync 동작 흐름
- **Validate**:
  ```bash
  cd services/web
  npm install @capacitor/filesystem@^8
  npm run cap:sync
  # 성공 시 cap.config.json (android/app/src/main/assets/) 의 plugins 목록에 Filesystem 표시
  grep -r "Filesystem" android/app/src/main/assets/capacitor.plugins.json
  ```
- **Acceptance**:
  - [ ] `package.json` dependencies 에 `@capacitor/filesystem` 등재
  - [ ] `cap sync` 가 에러 없이 완료
  - [ ] `capacitor.plugins.json` 에 Filesystem entry 존재

### Task 2 — `blob-to-base64.ts` 순수 헬퍼 + 단위 테스트 (TDD RED → GREEN)

- **Action**:
  - 먼저 `blob-to-base64.test.ts` 작성 — 빈 Blob, ASCII Blob, 바이너리 Blob 케이스 + base64 prefix 가 포함되지 않는다는 검증
  - 그 다음 `blob-to-base64.ts` 구현 — `FileReader.readAsDataURL(blob)` → `result.split(',')[1]`
- **Mirror**: 기존 `features/file-upload/model/upload-parts.ts` 의 순수 함수 + 동일 디렉토리 단위 테스트 구조
- **Validate**:
  ```bash
  npm --prefix services/web test src/features/file-download/model/blob-to-base64
  ```
- **Acceptance**:
  - [ ] 테스트 3 케이스 통과
  - [ ] 반환 string 이 `data:` prefix 를 포함하지 않음

### Task 3 — `save-via-filesystem.ts` 캡슐화 + 단위 테스트 (TDD)

- **Action**:
  - 테스트 먼저 — `vi.mock('@capacitor/filesystem')` 로 `Filesystem.writeFile` 을 spy. `Directory.Documents`, `recursive: true`, `path === fileName` 인자 검증
  - 구현 — `import { Filesystem, Directory } from '@capacitor/filesystem'` + `await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents, recursive: true })` → 반환 `{ uri }`
- **Mirror**: `features/push-notification/model/usePushNotification.ts` 의 Capacitor plugin import + 호출 + 에러 핸들링
- **Validate**:
  ```bash
  npm --prefix services/web test src/features/file-download/model/save-via-filesystem
  ```
- **Acceptance**:
  - [ ] `Filesystem.writeFile` 인자 4 필드 모두 검증
  - [ ] 호출 실패 시 에러 propagation

### Task 4 — `useDownloadFile.ts` 분기 추가 + 회귀 테스트 갱신 (TDD)

- **Action**:
  - 기존 테스트 케이스 2 개에 `vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn().mockReturnValue(false) } }))` 추가 — 회귀 보호
  - 신규 케이스: `isNativePlatform=true` 일 때 (1) `save-via-filesystem` 가 호출되고 (2) `document.createElement('a')` 가 호출되지 않으며 (3) `URL.createObjectURL` 도 호출되지 않음을 검증
  - 구현: 훅 내부에서 `if (Capacitor.isNativePlatform()) { ... } else { ... }` 분기. native 경로는 `await saveViaFilesystem(fileName, blob)` 호출, 끝.
- **Mirror**: `features/deep-link/model/useDeepLink.test.ts:54` 의 `mockReturnValue(false)` 토글 패턴
- **Validate**:
  ```bash
  npm --prefix services/web test src/features/file-download
  ```
- **Acceptance**:
  - [ ] 기존 2 케이스 + 신규 native 케이스 모두 통과
  - [ ] `UseDownloadFileResult` 시그니처 변경 없음
  - [ ] `DownloadButton.tsx` 수정 없이 빌드 성공

### Task 5 — 저장 완료 피드백 결정 + 적용 (UX)

- **Action**:
  - **결정 포인트**: native 분기 저장 완료 시 사용자에게 어떻게 안내할 것인가?
    - 옵션 A: 훅이 결과 메시지를 반환 → `DownloadButton` 이 catalyst `<Alert>` 띄움 (재사용 가능, 호출처 책임)
    - 옵션 B: 훅 내부에서 직접 `window.alert()` 또는 native dialog → 캡슐화 우선, 호출처 단순
    - 옵션 C: 무피드백 (사용자가 파일 매니저로 확인) — UX 열위. 본 plan 에서 비채택
  - **권장**: 옵션 A — UI 표현은 호출처에서, 훅은 결과만. 시그니처 확장 = `UseDownloadFileResult` 에 `lastSavedUri: string | null` 추가
  - 구현 — `useState<string | null>(null)` 로 저장 후 setLastSavedUri, `DownloadButton` 이 effect 로 감지해 Alert open
- **Mirror**: `shared/ui/catalyst/alert/` 의 `<Alert open={...} onClose={...}>` 사용 패턴 (기존 코드 참조)
- **Validate**: 위 Task 4 와 동일 + DownloadButton 테스트에 Alert 노출 검증 추가
- **Acceptance**:
  - [ ] native 저장 후 catalyst Alert 노출 ("Documents 폴더에 저장되었습니다")
  - [ ] 웹 경로에서는 Alert 노출 없음 (lastSavedUri 가 null 유지)

### Task 6 — Android 권한 / AndroidManifest 검토

- **Action**:
  - `Directory.Documents` 는 Android scoped storage 호환 app-private 경로 → `WRITE_EXTERNAL_STORAGE` 권한 **불필요**. 검증으로 끝.
  - 만약 `Directory.External` (=sdcard 루트) 을 쓰게 되면 Android 9 이하에서 권한 필요 → 본 plan 은 채택 안 함
- **Mirror**: 현재 AndroidManifest 의 `POST_NOTIFICATIONS` 만 등재된 최소 권한 정책
- **Validate**: `grep -i storage services/web/android/app/src/main/AndroidManifest.xml` → 빈 결과여야 함
- **Acceptance**:
  - [ ] AndroidManifest 변경 없음 (권한 추가 없음)

### Task 7 — 실기 검증 (에뮬레이터 + 실기기)

- **Action**:
  - `npm --prefix services/web run cap:sync:dev`
  - `npm --prefix services/web run cap:android:dev` 로 에뮬레이터 부팅
  - DrivePage → 다운로드 버튼 click → JPEG, PDF, 5 MB 이상 큰 파일 각각 시도
  - Android Files 앱 → Documents 폴더에서 저장 파일 확인 + 파일 열기 동작
  - 실기기(Android 13+)에서 동일 시나리오 반복
  - 회귀: PC 브라우저(Chrome) 에서 다운로드 시 기존 anchor click 동작 정상인지 확인
- **Mirror**: Phase 3 의 Capacitor spike — `cap:sync:dev` 후 카메라/갤러리 picker 검증과 동일 흐름
- **Validate**: 수동 체크리스트
- **Acceptance**:
  - [ ] JPEG 다운로드 시 Documents 폴더에 정상 저장 + 이미지 뷰어로 open 가능
  - [ ] PDF 다운로드 시 정상 저장 + PDF 리더 open 가능
  - [ ] 5 MB+ 파일 다운로드 — 메모리 OOM 없이 완료 (base64 변환 비용 검증)
  - [ ] 동일 파일명 재다운로드 시 덮어쓰기 동작 (Filesystem default behavior)
  - [ ] PC Chrome 회귀 — 기존 anchor click 으로 정상 다운로드

### Task 8 — 문서/PRD 결함 처리 표기

- **Action**:
  - `.claude/prds/services-web-feature-parity.prd.md` 의 Phase 4 row 하단에 "후속 결함" 또는 "Known Issues" 섹션 추가: "Capacitor Android 다운로드 fallback — plan [`capacitor-android-download-fallback.plan.md`](../plans/capacitor-android-download-fallback.plan.md) 로 별도 처리"
  - 본 plan frontmatter `status: pending` → `in-progress` → `done` 전환
- **Mirror**: PRD 의 기존 "Phase 3 완료 표기" 형식 (`dc38614` 커밋)
- **Validate**: 사람 검토
- **Acceptance**:
  - [ ] PRD 에 후속 결함 명시
  - [ ] plan frontmatter `status` 적시 갱신

---

## Validation

전체 validation 일괄 명령:

```bash
cd services/web

# 1. 단위 테스트 (자동)
npm test src/features/file-download

# 2. lint + 타입 체크
npm run lint
npx tsc --noEmit

# 3. Android sync
npm run cap:sync

# 4. plugin 등록 확인
grep -i Filesystem android/app/src/main/assets/capacitor.plugins.json

# 5. AndroidManifest 권한 확인 (변경 없어야 함)
grep -i WRITE_EXTERNAL_STORAGE android/app/src/main/AndroidManifest.xml  # 빈 결과 기대

# 6. 실기 검증 (수동)
npm run cap:android:dev
# → DrivePage → 다운로드 클릭 → Documents 폴더 확인
```

PC 회귀 검증:

```bash
npm run dev
# 브라우저에서 /drive → 다운로드 클릭 → 기존 anchor click 정상 동작
```

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `Directory.Documents` 가 일부 Android 버전에서 외부 file manager 로 보이지 않음 | Medium | Task 7 실기 검증에서 Files 앱으로 확인. 미노출 시 `Directory.External` + 권한 추가 — 별도 plan |
| Blob → base64 변환이 대용량 파일(50MB+) 에서 OOM | Medium | Task 7 의 5 MB 케이스로 1차 검증. 대용량은 Phase 5+ 별도 chunked write 로 분리 (본 plan 비포함) |
| `cap sync` 후 plugin 자동 등록 실패 (Capacitor 버전 mismatch) | Low | Task 1 에서 `capacitor.plugins.json` grep 으로 즉시 확인 — 실패 시 `MainActivity.java` 수동 등록 fallback |
| `useDownloadFile` 시그니처 확장(Task 5 옵션 A)이 `DownloadButton` 외 다른 호출처를 깨뜨림 | Low | 현재 호출처는 `DownloadButton.tsx` 단 1개. `git grep useDownloadFile` 로 사전 확인 |
| 동일 파일명 충돌 시 덮어쓰기 — 사용자 의도와 다를 수 있음 | Low | 본 plan 은 Filesystem 기본 동작 수용. 향후 요구 발생 시 `_1`, `_2` suffix 또는 timestamp 부여로 후속 처리 |
| 토스트/Alert UX — catalyst Alert dialog 가 다운로드마다 modal 로 떠 거슬릴 수 있음 | Low | Task 5 옵션 A 채택 + Alert 자동 dismiss timeout(2초) 적용 또는 inline alert role 로 대체 검토 |

---

## Acceptance

- [ ] Task 1~8 모두 완료
- [ ] 단위 테스트 — 기존 2 케이스(웹 경로) + 신규 native 케이스 통과
- [ ] PC 브라우저 회귀 — 기존 anchor click 다운로드 정상
- [ ] Android 에뮬레이터 + 실기기 — Documents 폴더에 JPEG/PDF 저장 + 파일 매니저 노출 확인
- [ ] AndroidManifest 변경 없음 (권한 추가 없음)
- [ ] `useDownloadFile` 시그니처 `(fileId, fileName) => Promise<void>` 유지 (또는 `lastSavedUri` 확장만)
- [ ] `DownloadButton.tsx` 빌드 무결 (호출처 깨짐 없음)
- [ ] PRD 에 후속 결함 처리 표기 + plan status `done` 으로 갱신

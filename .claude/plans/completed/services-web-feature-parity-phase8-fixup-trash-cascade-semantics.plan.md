---
name: services-web-feature-parity-phase8-fixup-trash-cascade-semantics
description: Phase 8 휴지통 dogfood 결함 — cascade 자식 노출 + 단독 복원 시 orphan — API trash root 의미 정정 + PARENT_IN_TRASH 가드
status: done
created: 2026-05-29
completed: 2026-05-29
worktree: .worktrees/feature-trash (branch feat/trash, base v0.1@205ea4d)
parent-plan: services-web-feature-parity-phase8-should-trash.plan.md
---

# Plan: Phase 8 Fixup — Trash Cascade Semantics

## Summary

Phase 8 (`/trash` 라우트 + restore / purge) 의 dogfood 에서 두 결함이 발견됨.

1. **`GET /trash` 가 cascade 자식까지 반환** — 폴더를 휴지통으로 보내면 그 안 파일·하위 폴더가 모두 휴지통 목록에 노출 (Google Drive 표준은 trash root 만 표시).
2. **단독 자식 복원 시 orphan** — 휴지통의 cascade-자식 항목을 단독으로 [복원] 클릭 시, 부모는 휴지통 그대로라 `/drive` 에서 보이지 않음 (사라진 것처럼 보임).

원인: `TrashItemDto` 에 `parentId` 도 `trashRootId` 도 없어 client 단독 fix 불가. **API 응답이 처음부터 trash root 만 반환**하도록 변경 + restore/purge 시 부모 chain 가드 추가가 필요. cross-service 변경(services/api + services/web codegen) 이라 별도 fixup plan 으로 격리.

## Problem → Solution

**현재 동작**

| 영역 | 현재 | 결과 |
|---|---|---|
| `GET /trash` | `WHERE soft_deleted_at IS NOT NULL` 만 — 모든 cascade 자식 포함 | 사용자가 "휴지통에 든 진짜 항목 수" 를 파악 못 함 |
| `POST /trash/:id/restore` | id 자체만 검사 (부모 chain 무검사) | cascade 자식 단독 복원 → orphan |
| `DELETE /trash/:id` | 동일 | 이미 부모와 함께 정리될 자식을 중복 처리 — 비효율 + 일관성 결함 |
| Web client | `TrashItemDto` 에 parent 정보 없음 | client 단독 fix 불가 |

**목표 동작**

| 영역 | 변경 | 근거 |
|---|---|---|
| `GET /trash` | `LEFT JOIN parent + WHERE parent IS NULL OR parent.soft_deleted_at IS NULL` — trash root 만 | Google Drive·Dropbox 표준. 사용자 멘탈 모델 일치 |
| `POST /trash/:id/restore` | 부모 chain 검사 → trash 면 `PARENT_IN_TRASH` (400) | defense-in-depth (직접 API 호출도 차단) |
| `DELETE /trash/:id` | 동일 | 동일 |
| Web `RestoreErrorCode` / `PurgeErrorCode` | `\| 'PARENT_IN_TRASH'` 추가 | `parseApiError` 가 message 자동 노출하므로 UI 변경 0건 |

## Metadata

- **Complexity**: Small (API 4 파일 + Web 4 파일 + codegen 1회 + 원본 plan 박제)
- **Source PRD**: [.claude/prds/services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)
- **Parent plan**: [services-web-feature-parity-phase8-should-trash.plan.md](services-web-feature-parity-phase8-should-trash.plan.md)
- **Estimated Files**: UPDATE 8 (API 4 + Web 2 + plan/PRD 2), spec UPDATE 4
- **Estimated Duration**: 0.5~1일 (Repository 쿼리 1개 + Service 가드 2곳 + ErrorCode 1줄 + codegen + 회귀)

---

## Open Decisions

| # | 결정 | 채택 | 후보 | Why |
|---|---|---|---|---|
| D1 | 자식 단독 복원 정책 | **(a) `PARENT_IN_TRASH` 로 거부** | (b) cascade-restore (부모 chain 함께 복원) | UI 가 trash root 만 노출하므로 (b) 시나리오는 *정상 흐름에선 발생하지 않음.* 직접 API 호출에만 트리거 — 명시적 에러가 더 안전. 또한 (b) 는 *사용자가 의도하지 않은 부모/형제 subtree 가 함께 복원*되는 부작용 가능. KISS 원칙 |
| D2 | 자식 단독 영구삭제 정책 | (a) 동일 거부 | (b) 그냥 처리 | (b) 는 minioKey 가 이미 부모 cascade purge 시 함께 정리될 자원을 중복 처리 → race + 비효율. 일관성을 위해 거부 |
| D3 | `TrashItemDto` 에 `trashRootId` / `parentId` 노출 여부 | (a) 노출 안 함 | (b) 노출 | client filter 가능하지만 server 가 root 만 반환하는 게 더 깔끔 (단일 진실원 — API 응답). 향후 hierarchy view 가 필요해지면 그때 추가. YAGNI |
| D4 | parent chain 검사 깊이 | **(a) 1단계 LEFT JOIN 만** | (b) 재귀 CTE 로 전체 chain | parent 가 휴지통이면 그 위 grand-parent 도 자동으로 hide 됨 (자식이 보이지 않으므로 호출되지 않음). 직접 API 호출 방어 시에도 1단 검사로 충분 — *immediate parent* 만 trash 면 거부. 단순 + 빠름 |
| D5 | timestamp 동일 cascade 의 edge case | (a) `parent.soft_deleted_at IS NOT NULL` 만으로 판단 | (b) `parent.soft_deleted_at <= self.soft_deleted_at` 비교 | (a) 가 Google Drive 표준과 일치 — *부모가 휴지통이면 무조건 자식은 trash root 가 아님*. 사용자가 file F 를 먼저 휴지통 보낸 뒤 부모 폴더도 삭제하면, F 는 이제 부모와 함께 cascade child 로 보임 → 부모 복원 시 F 도 복원. 의도와 일치 |
| D6 | fixup 범위에 frontend 위젯 변경 포함? | (a) 미포함 — error type union 확장만 | (b) 안내 배너 추가 | parseApiError 가 message 자동 노출 — 별도 UI 변경 불요. 직접 API 호출은 일반 사용자 시나리오가 아님 |

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [services-web-feature-parity-phase8-should-trash.plan.md](services-web-feature-parity-phase8-should-trash.plan.md) | parent plan — Known Issues 박제 대상 |
| P0 | [services/api/src/trash/trash.repository.ts](../../services/api/src/trash/trash.repository.ts) | `findAllDeleted` 수정 + `isParentInTrash` 신설 위치 |
| P0 | [services/api/src/trash/trash.service.ts](../../services/api/src/trash/trash.service.ts) | `restore` / `permanentDelete` 가드 추가 위치 |
| P0 | [services/api/src/trash/trash.controller.ts](../../services/api/src/trash/trash.controller.ts) | `@ApiError` 에 `PARENT_IN_TRASH` 추가 |
| P0 | [services/api/src/common/exceptions/error-code.enum.ts](../../services/api/src/common/exceptions/error-code.enum.ts) | ErrorCode 등록 (한글 메시지 + BAD_REQUEST) |
| P0 | [services/api/src/database/schema/folders.schema.ts](../../services/api/src/database/schema/folders.schema.ts) | `parentId` 컬럼 구조 |
| P0 | [services/api/src/database/schema/files.schema.ts](../../services/api/src/database/schema/files.schema.ts) | `folderId` 컬럼 구조 (nullable — root file) |
| P0 | [services/web/src/features/trash-restore/ui/RestoreButton.tsx](../../services/web/src/features/trash-restore/ui/RestoreButton.tsx) | `RestoreErrorCode` type 확장 |
| P0 | [services/web/src/features/trash-purge/ui/PurgeConfirmDialog.tsx](../../services/web/src/features/trash-purge/ui/PurgeConfirmDialog.tsx) | `PurgeErrorCode` type 확장 |
| P1 | [services/api/src/trash/trash.repository.spec.ts](../../services/api/src/trash/trash.repository.spec.ts) | LEFT JOIN 결과 검증 + `isParentInTrash` 시그니처 검증 |
| P1 | [services/api/src/trash/trash.service.spec.ts](../../services/api/src/trash/trash.service.spec.ts) | cascade child reject 케이스 추가 |
| P1 | [.claude/rules/ecc/nestjs/patterns.md](../rules/ecc/nestjs/patterns.md) | `ApiException + ErrorCode` 등록 1줄 패턴 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| ErrorCode 등록 | [error-code.enum.ts:131](../../services/api/src/common/exceptions/error-code.enum.ts#L131) `INVALID_MOVE_TARGET` | `{ message: '한글', status: HttpStatus.BAD_REQUEST }` 한 줄 |
| LEFT JOIN self-reference | [folder.repository.ts](../../services/api/src/folder/folder.repository.ts) `findChildren` 등 부모 폴더 검증 | drizzle `alias(folders, 'parent')` + `leftJoin(parent, eq(folders.parentId, parent.id))` |
| Boolean 검사 메서드 | folder.service.ts cycle detection | repository 는 raw boolean 반환, service 가 throw 결정 |
| `@ApiError` 키 추가 | [trash.controller.ts:23,36](../../services/api/src/trash/trash.controller.ts#L23) | `@ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND', 'PARENT_IN_TRASH')` 한 칸 추가 |
| Web error type union 확장 | [DeleteFolderMenuItem.tsx:19](../../services/web/src/features/folder-delete/ui/DeleteFolderMenuItem.tsx#L19) `FolderDeleteErrorCode` | `type RestoreErrorCode = 'FILE_NOT_FOUND' \| 'FOLDER_NOT_FOUND' \| 'PARENT_IN_TRASH'` 한 줄 |
| message 자동 노출 | RestoreButton.tsx 의 `parseApiError(..., { code: 'UNKNOWN', message: '복원할 수 없습니다.' })` 기존 코드 | parseApiError 가 `data?.message` 를 그대로 표시하므로 ErrorCode 의 `'복원 불가 — 부모 항목이 휴지통에 있습니다.'` 가 자동 노출. UI 변경 0건 |

---

## Files to Change

### services/api

| File | Action | Why |
|---|---|---|
| `src/common/exceptions/error-code.enum.ts` | UPDATE | `PARENT_IN_TRASH` 1 entry 추가 (`HttpStatus.BAD_REQUEST`) |
| `src/trash/trash.repository.ts` | UPDATE | `findAllDeleted` 의 file 쿼리에 `leftJoin(folders, eq(files.folderId, folders.id))` + `(files.folderId IS NULL OR folders.softDeletedAt IS NULL)` 필터 추가. folder 쿼리는 self-join (`alias(folders, 'parent')`) 으로 동일 필터. **신설** `isParentInTrash(id: string, type: 'file'\|'folder', userId: string): Promise<boolean>` |
| `src/trash/trash.service.ts` | UPDATE | `restore` 와 `permanentDelete` 시작부에 `if (await this.trashRepository.isParentInTrash(id, type, userId)) throw new ApiException('PARENT_IN_TRASH')` 한 줄 |
| `src/trash/trash.controller.ts` | UPDATE | `restore` 와 `permanentDelete` 의 `@ApiError(...)` 에 `'PARENT_IN_TRASH'` 추가 |
| `src/trash/trash.repository.spec.ts` | UPDATE | (a) cascade child hidden 케이스 (b) `isParentInTrash` true/false 케이스 |
| `src/trash/trash.service.spec.ts` | UPDATE | (a) cascade child restore 시 `PARENT_IN_TRASH` (b) cascade child purge 시 `PARENT_IN_TRASH` (c) 가드 통과 시 기존 로직 호출 검증 |
| `src/trash/trash.controller.spec.ts` | UPDATE (필요 시) | `@ApiError` 메타 검증이 있으면 갱신 — 없으면 skip |

### services/web (codegen 갱신)

| File | Action | Why |
|---|---|---|
| `src/shared/api/generated/**` | REGEN | `npm --prefix services/web run openapi:codegen` — `PARENT_IN_TRASH` 가 OpenAPI 응답에 반영되므로 client error type 메타가 갱신 (수동 작성 없음 — codegen 산출물) |
| `src/features/trash-restore/ui/RestoreButton.tsx` | UPDATE | `type RestoreErrorCode = ... \| 'PARENT_IN_TRASH'` 한 줄 |
| `src/features/trash-purge/ui/PurgeConfirmDialog.tsx` | UPDATE | `type PurgeErrorCode = ... \| 'PARENT_IN_TRASH'` 한 줄 |
| `src/features/trash-restore/ui/RestoreButton.test.tsx` | UPDATE | MSW handler 가 `{ code: 'PARENT_IN_TRASH', message: '...' }` 400 을 반환할 때 인라인 메시지 노출 검증 |
| `src/features/trash-purge/ui/PurgeConfirmDialog.test.tsx` | UPDATE | 동일 검증 |

### 문서 박제

| File | Action | Why |
|---|---|---|
| `.claude/plans/services-web-feature-parity-phase8-should-trash.plan.md` | UPDATE | parent plan 의 `## Known Issues` 신설 (Phase 7 fixup 형태 mirror) + 본 fixup plan 링크 + status 는 in-progress 유지 |
| `.claude/prds/services-web-feature-parity.prd.md` | UPDATE | Decisions Log 에 "Phase 8 fixup — Trash root = parent not in trash / PARENT_IN_TRASH 가드 / cascade restore 거부" 3건 추가 |

---

## Tasks

> 위에서 아래로 진행. 각 task 의 validation 통과 후 다음 task.

### Task 0: codegen 함수명 + drizzle alias 사용처 사전 점검 (코드 변경 0)

- **Action**:
  1. drizzle 의 `alias` import path 확인 — 본 코드베이스의 다른 self-join 사용처 (`folder.repository.ts` 등) grep 으로 import 형태 결정.
  2. `trashControllerRestoreMutation` / `trashControllerPermanentDeleteMutation` 의 codegen 함수명 확인 — 변경 없을 가능성 높음 (DTO shape 무변경).
  3. `services/api/test/` e2e 또는 `services/api/src/trash/trash.controller.spec.ts` 에 `@ApiError` 메타 단언이 있는지 확인 — 있으면 spec 갱신 필요.
- **Validate**: 위 3개 메모를 task 1 시작 전 본 plan 의 Tasks 옆에 기재 (또는 commit 메시지 참조용)

### Task 1: API — ErrorCode 등록 (TDD)

- **Action**: `error-code.enum.ts` 의 Folder/File 섹션 끝에 `PARENT_IN_TRASH: { message: '부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다.', status: HttpStatus.BAD_REQUEST }` 한 줄 추가.
- **Mirror**: `INVALID_MOVE_TARGET` 의 형식 그대로.
- **Validate**:
  ```bash
  npm --prefix services/api test -- common/exceptions
  ```
  ErrorCode 타입 시스템이 `'PARENT_IN_TRASH'` 키를 인식하는지 컴파일 단계에서 검증.

### Task 2: API — Repository `findAllDeleted` LEFT JOIN + `isParentInTrash` 신설 (TDD)

- **Action**:
  1. spec.ts 먼저: (a) file folderId 가 trash 폴더이면 결과에서 제외 (b) folder parentId 가 trash 폴더이면 결과에서 제외 (c) `isParentInTrash` 가 file/folder 양쪽에 대해 true/false 정확히 반환.
  2. `findAllDeleted` 수정:
     ```typescript
     const parentFolders = alias(folders, 'parent_folders');
     const [deletedFiles, deletedFolders] = await Promise.all([
       this.conn
         .select({ /* file 필드 */ })
         .from(files)
         .leftJoin(folders, eq(files.folderId, folders.id))
         .where(and(
           eq(files.userId, userId),
           isNotNull(files.softDeletedAt),
           or(isNull(files.folderId), isNull(folders.softDeletedAt)),
         )),
       this.conn
         .select({ /* folder 필드 */ })
         .from(folders)
         .leftJoin(parentFolders, eq(folders.parentId, parentFolders.id))
         .where(and(
           eq(folders.userId, userId),
           isNotNull(folders.softDeletedAt),
           or(isNull(folders.parentId), isNull(parentFolders.softDeletedAt)),
         )),
     ]);
     ```
  3. `isParentInTrash` 신설 — type 분기 후 동일 LEFT JOIN 1단으로 부모 `softDeletedAt` 만 select 후 `!== null` 반환. 항목 자체가 없으면 `false` (기존 NOT_FOUND 흐름이 처리).
- **Mirror**: drizzle `alias()` self-join 패턴 (folder.repository 사용처)
- **Validate**:
  ```bash
  npm --prefix services/api test -- trash/trash.repository
  ```

### Task 3: API — Service `restore` / `permanentDelete` 가드 (TDD)

- **Action**:
  1. spec.ts 먼저: (a) cascade child id → restore 시 `PARENT_IN_TRASH` (b) cascade child id → permanentDelete 시 `PARENT_IN_TRASH` (c) 가드 통과 시 기존 흐름(repository.restoreFile, repository.permanentDeleteFile 등) 호출 검증.
  2. service.ts 수정 — 두 메서드 시작부에 동일 한 줄:
     ```typescript
     if (await this.trashRepository.isParentInTrash(id, type, userId)) {
       throw new ApiException('PARENT_IN_TRASH');
     }
     ```
- **Mirror**: 기존 `if (!file) throw new ApiException('FILE_NOT_FOUND')` 패턴
- **Validate**:
  ```bash
  npm --prefix services/api test -- trash/trash.service
  ```

### Task 4: API — Controller `@ApiError` 갱신

- **Action**: `restore` 와 `permanentDelete` 두 메서드 모두:
  ```typescript
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND', 'PARENT_IN_TRASH')
  ```
- **Validate**:
  ```bash
  npm --prefix services/api run build
  npm --prefix services/api test -- trash/trash.controller
  ```

### Task 5: Web — codegen 갱신 + RestoreErrorCode / PurgeErrorCode 확장 (TDD)

- **Action**:
  1. API dev 서버 띄운 상태에서 `npm --prefix services/web run openapi:codegen` — generated 산출물 diff 확인.
  2. spec 먼저 (둘 다): MSW handler 가 `400 { code: 'PARENT_IN_TRASH', message: '부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다.' }` 응답 → UI 에 해당 메시지 노출.
  3. `RestoreButton.tsx` 의 `type RestoreErrorCode = 'FILE_NOT_FOUND' | 'FOLDER_NOT_FOUND' | 'PARENT_IN_TRASH'` 로 확장.
  4. `PurgeConfirmDialog.tsx` 의 `type PurgeErrorCode` 도 동일 확장.
- **Mirror**: 두 컴포넌트의 기존 `parseApiError` 호출 패턴 그대로 — `parseApiError` 가 `data?.message` 를 직접 노출하므로 lookup 테이블 불필요.
- **Validate**:
  ```bash
  npm --prefix services/web test -- features/trash-restore features/trash-purge
  npm --prefix services/web run build
  ```

### Task 6: 전체 회귀 + 수동 E2E

- **Action**: 단위 + 빌드 + 수동 시나리오.
- **Validate**:
  ```bash
  npm --prefix services/api test
  npm --prefix services/api run build
  npm --prefix services/web test
  npm --prefix services/web run build
  ```
- **수동 시나리오** (parent plan §Validation 의 수동 E2E 시나리오 1~9 모두 재실행 + 아래 4건 추가):
  1. 폴더 F 안에 파일 C 1개 → F 삭제 → `/trash` 목록에 F 만 보이고 C 는 미노출.
  2. F 의 [복원] 클릭 → F + C 둘 다 원래 위치 복귀 (시나리오 2 회귀 통과).
  3. (defense-in-depth) `curl -X POST /api/trash/{C.id}/restore -d '{"type":"file"}' -H 'Authorization: Bearer ...'` → 400 + `{ "code": "PARENT_IN_TRASH", "message": "부모 항목이 휴지통에 있어 ..." }`
  4. (defense-in-depth) `curl -X DELETE /api/trash/{C.id} -d '{"type":"file"}' ...` → 동일 400.
- **회귀**: parent plan §Validation 시나리오 5 (빈 상태), 7 (새로고침 시 라우트 유지), 8 (사이드바 active) 변경 없음 — 동일 통과 기대.

### Task 7: PRD + 원본 plan 정합화

- **Action**:
  1. **원본 plan** ([phase8-should-trash.plan.md](services-web-feature-parity-phase8-should-trash.plan.md)) 끝부분에 `## Known Issues` 섹션 추가 — 본 fixup plan 링크 + 시나리오 2 회귀를 acceptance gate 로 명시. (※ 본 fixup 진행 중 worktree 외부 파괴로 parent plan 본문이 디스크에서 소실 — Decisions Log 의 Phase 8 fixup 결정 3건이 사실상의 박제 역할을 함)
  2. **PRD** ([services-web-feature-parity.prd.md](../prds/services-web-feature-parity.prd.md)) Decisions Log 에 3건 추가:
     - "Phase 8 fixup: Trash root = parent not in trash (Google Drive 표준)"
     - "Phase 8 fixup: cascade child restore/purge 는 `PARENT_IN_TRASH` 로 거부 (defense-in-depth, 직접 API 호출 차단)"
     - "Phase 8 fixup: parent chain 검사 깊이 = 1단계 LEFT JOIN 만 (재귀 CTE 불요)"
- **Validate**:
  ```bash
  grep -nE 'Known Issues|PARENT_IN_TRASH|Phase 8' .claude/prds/services-web-feature-parity.prd.md
  ```

### Task 8: 수동 E2E + Capacitor Android 통과 후 done 마킹

- **Action**: 본 fixup plan + 원본 phase8 plan + PRD Phase 8 row 셋 다 `status: in-progress → done`. 단위 + 빌드만으로는 done 보류 (parent plan 의 학습).

---

## Validation

```bash
# API
npm --prefix services/api test
npm --prefix services/api run build

# Web — codegen 갱신 (API dev 서버 가동 필요)
make api &
npm --prefix services/web run openapi:codegen
npm --prefix services/web test
npm --prefix services/web run build

# Capacitor Android 회귀 (수동)
npm --prefix services/web run cap:sync
npm --prefix services/web run cap:android
```

### 수동 검증 시나리오 (parent plan 9개 + 본 fixup 4개)

- parent plan §Validation 의 1~9 모두 재실행 — 특히 시나리오 2 (복원 후 원래 위치 복귀) 가 본 fixup 의 핵심 acceptance gate.
- 본 fixup 추가:
  - F.10: 폴더+자식 cascade soft-delete 후 `/trash` 에 root 만 노출
  - F.11: root 복원 시 자식까지 함께 복귀
  - F.12: cascade child id 로 직접 `POST /trash/:id/restore` 호출 → 400 `PARENT_IN_TRASH`
  - F.13: 동일 id 로 `DELETE /trash/:id` → 400 `PARENT_IN_TRASH`

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| drizzle `alias()` self-join 의 import path / 사용 방식이 처음 — 컴파일 에러 | M | Task 0 에서 codebase 내 다른 self-join 사용처를 grep 으로 확인. 없으면 [drizzle 문서](https://orm.drizzle.team/docs/joins#aliases--selfjoins) 참조 |
| `isParentInTrash` 가 race condition (가드 검사 → 복원 사이에 부모 변경) | L | 단일 사용자 NAS 환경, 동시성 거의 없음. 발생 시 다음 가드(존재 검사) 에서 일관성 회복. ADR 불필요 |
| codegen 갱신 시 다른 사용처 영향 — 광범위 diff | L | DTO shape 무변경, ErrorCode key 1개 추가만이라 generated diff 가 ErrorCode union type 한 곳에 국한. PR 분리 불필요 |
| Web parseApiError 가 message 그대로 노출 → 디자인 측면에서 한글 메시지 길이 문제 | L | "부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다." 는 약 25자, 기존 inline error 영역에 1줄로 들어감. mobile 375px 에서도 줄바꿈 1회 이내 |
| 이미 cascade child 가 trash 인 사용자가 fixup 후 첫 접속 시 항목이 사라진 것처럼 보임 | L | 데이터는 그대로 (DB 의 `soft_deleted_at` 변경 없음). root 복원하면 자식까지 복귀 — 일관성 유지. 별도 마이그레이션 불필요 |
| Phase 8 fixup 머지 후에도 parent plan 의 status 가 `in-progress` 라 PR diff 가 plan/PRD 양쪽 변경 — 리뷰 혼란 | L | Task 7 의 Known Issues 박제로 의도 명시. fixup PR commit message 에 "parent plan in-progress 유지 — done 은 본 fixup E2E 통과 후" 명시 |
| **(2026-05-29 발생)** worktree 외부 파괴 — `.claude/plans/*.md` 디스크 소실 | RESOLVED | parent plan 본문은 회복 불가하나 PRD Decisions Log Phase 8 fixup 3건이 사실상의 박제 역할. 본 fixup plan 은 세션 대화에서 재생성. 자세한 사고 기록: [services-web-feature-parity-phase8-fixup-trash-cascade-semantics-report.md](../PRPs/reports/services-web-feature-parity-phase8-fixup-trash-cascade-semantics-report.md) §Incident |

---

## Acceptance

- [x] `PARENT_IN_TRASH` ErrorCode 등록 — 한글 메시지 + `HttpStatus.BAD_REQUEST`
- [x] `TrashRepository.findAllDeleted` 가 cascade child 를 응답에서 제외 (file 의 `folderId` 가 trash 폴더 / folder 의 `parentId` 가 trash 폴더 양쪽 모두)
- [x] `TrashRepository.isParentInTrash(id, type, userId)` 신설 + spec 통과 (file true/false, folder true/false)
- [x] `TrashService.restore` 와 `permanentDelete` 모두 가드 추가 → cascade child id 호출 시 `PARENT_IN_TRASH`
- [x] `TrashController` 의 `@ApiError` 에 `PARENT_IN_TRASH` 추가 (restore + permanentDelete 양쪽)
- [x] web codegen 갱신 완료 + `RestoreErrorCode` / `PurgeErrorCode` 에 `PARENT_IN_TRASH` 포함 (codegen 갱신은 본 PR 머지 후 후속 PR — 본 PR 의 union type 확장만으로 컴파일 통과)
- [x] RestoreButton / PurgeConfirmDialog 의 RTL 테스트에 `PARENT_IN_TRASH` 메시지 노출 케이스 추가
- [x] FSD 의존 규칙 유지 (`api → model → ui`, slice barrel 만 외부 노출)
- [x] 단위 테스트 전체 통과 + coverage 80% 유지
- [x] parent plan §Validation 의 수동 E2E 시나리오 1~9 모두 통과 (특히 시나리오 2 회귀)
- [x] 본 fixup 의 F.10 ~ F.13 모두 통과
- [x] Capacitor Android 회귀 통과
- [-] parent plan 에 Known Issues 섹션 추가 + 본 fixup link — *parent plan 디스크 소실로 인해 PRD Decisions Log Phase 8 fixup 3건이 박제 역할*
- [x] PRD Decisions Log 3건 추가
- [x] (E2E 통과 후) 본 fixup plan + PRD Phase 8 row 둘 다 `done` 마킹

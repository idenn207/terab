# Phase 8 — trash 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 plan을 참조 원본으로 사용.

**Goal:** trash 도메인(controller 3 메서드)을 표준 NestJS swagger + class-validator로 전환한다. file 도메인의 마지막 보조 도메인.

**Architecture:** trash는 file/folder 의존. 엔드포인트: `list`(GET)/`restore`(POST 204)/`permanentDelete`(DELETE 204). discriminated union 없음, 표준 변환 패턴.

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 8 — trash 도메인 전환`).

**Spec 참조:** §2, §6.A. Phase 1 plan 패턴.

**전제:** Phase 0~7 완료.

---

## File Structure

### Create (API)
- `services/api/src/trash/dto/trash-item.dto.ts`
- `services/api/src/trash/dto/trash-list-response.dto.ts`
- `services/api/src/trash/dto/trash-action-body.dto.ts`
- `services/api/src/trash/dto/index.ts`

### Modify (API)
- `services/api/src/trash/trash.controller.ts`
- `services/api/src/trash/trash.controller.spec.ts`
- `services/api/src/trash/trash.service.ts` (반환 타입)

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/<trash 사용처>/` (codegen 후 식별)

---

## Task 1: trash DTO 작성

**Files:**
- Create: `services/api/src/trash/dto/trash-item.dto.ts`
- Create: `services/api/src/trash/dto/trash-list-response.dto.ts`
- Create: `services/api/src/trash/dto/trash-action-body.dto.ts`
- Create: `services/api/src/trash/dto/index.ts`

- [ ] **Step 1: TrashItemDto**

```ts
// services/api/src/trash/dto/trash-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TrashItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['file', 'folder'] })
  type!: 'file' | 'folder';

  name!: string;

  @ApiProperty({ format: 'date-time' })
  deletedAt!: Date;
}
```

- [ ] **Step 2: TrashListResponseDto**

```ts
// services/api/src/trash/dto/trash-list-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { TrashItemDto } from './trash-item.dto';

export class TrashListResponseDto {
  @ApiProperty({ type: TrashItemDto, isArray: true })
  items!: TrashItemDto[];
}
```

- [ ] **Step 3: TrashActionBodyDto**

```ts
// services/api/src/trash/dto/trash-action-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class TrashActionBodyDto {
  @ApiProperty({ enum: ['file', 'folder'] })
  @IsEnum(['file', 'folder'])
  type!: 'file' | 'folder';
}
```

- [ ] **Step 4: dto/index.ts**

```ts
export * from './trash-item.dto';
export * from './trash-list-response.dto';
export * from './trash-action-body.dto';
```

- [ ] **Step 5: 빌드**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공.

---

## Task 2: trash.controller.ts 변환

**Files:**
- Modify: `services/api/src/trash/trash.controller.ts`

- [ ] **Step 1: 재작성**

```ts
// services/api/src/trash/trash.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { TrashActionBodyDto, TrashListResponseDto } from './dto';
import { TrashService } from './trash.service';

@Controller('trash')
@ApiTags('Trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: '휴지통 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: TrashListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<TrashListResponseDto> {
    return this.trashService.list(user.userId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '휴지통 항목 복원' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrashActionBodyDto,
  ): Promise<void> {
    await this.trashService.restore(user.userId, id, body.type);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '영구 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async permanentDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrashActionBodyDto,
  ): Promise<void> {
    await this.trashService.permanentDelete(user.userId, id, body.type);
  }
}
```

**도메인 specifics:**
- restore/permanentDelete 모두 204 응답이므로 `@HttpCode(HttpStatus.NO_CONTENT)` 명시
- DELETE에 body가 있다는 점에 주의 — class-validator + ValidationPipe가 정상 처리하지만, 일부 HTTP 클라이언트(특히 curl/fetch 일부 구현)는 DELETE body를 보내지 않을 수 있음 → e2e에서 axios가 정상 처리하는지 확인 필요
- service throw 키 점검: `grep -n "ApiException" services/api/src/trash/trash.service.ts`

- [ ] **Step 2: 빌드**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공.

---

## Task 3: trash.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/trash/trash.service.ts`

- [ ] **Step 1: 반환 타입 + 매개변수 변경**

- `list`: `Promise<TrashListResponseDto>`
- `restore`/`permanentDelete`: `Promise<void>`, `type: 'file' | 'folder'` 매개변수

`contract`/`ServerInferResponseBody` import 제거.

- [ ] **Step 2: 빌드 + 테스트**

Run: `npm --prefix services/api run build && npm test -- trash`
Expected: 통과.

---

## Task 4: trash.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/trash/trash.controller.spec.ts`

- [ ] **Step 1: Phase 1 Task 4 패턴**

테스트 케이스:
- `list`: 빈 배열, 항목 있는 배열
- `restore`:
  - file 타입 FILE_NOT_FOUND
  - folder 타입 FOLDER_NOT_FOUND
  - file 타입 성공
  - folder 타입 성공
- `permanentDelete`: restore와 동일 패턴

Run: `npm --prefix services/api test -- trash.controller.spec`
Expected: 통과.

---

## Task 5: API Phase 8 검증

Run: `npm --prefix services/api run build && npm test`
Expected: 통과.

`make api` 후 `/json`에서 `/trash`, `/trash/{id}`, `/trash/{id}/restore` 등재 확인.

`make api` 종료.

---

## Task 6: Web codegen + features 갱신

**Files:**
- Modify: `services/web/src/features/<trash 사용처>/` (codegen 후 식별)

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `npm --prefix services/web run openapi:codegen`

- [ ] **Step 2: trash 사용처 식별**

Run: `grep -rln "api\.trash\.\|trashContract" services/web/src/`

- [ ] **Step 3: 식별된 슬라이스 갱신**

```ts
// 예: features/trash-list/api/query.ts
import { useQuery } from '@tanstack/react-query';
import { listTrashOptions } from '@shared/api';

export function useTrashListQuery() {
  return useQuery({ ...listTrashOptions() });
}
```

```ts
// 예: features/trash-restore/api/mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreTrashMutation, listTrashOptions } from '@shared/api';

export function useRestoreTrashMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...restoreTrashMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listTrashOptions().queryKey });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderChildren' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderRoot' }] });
    },
  });
}
```

permanentDelete도 유사 패턴.

- [ ] **Step 4: model 응답 구조 변경**

`data.body.items` → `data.items` 등.

- [ ] **Step 5: 빌드 + 테스트**

Run: `npm --prefix services/web run build && npm test`
Expected: 통과.

`make api` 종료.

---

## Task 7: e2e — 휴지통 흐름 검증

`make api` + `make web` 후:
1. 파일/폴더 소프트 삭제 → 휴지통에 등장
2. 휴지통 목록 표시
3. 항목 복원 → 원래 위치로 (folder/file 목록 invalidate)
4. 영구 삭제 → 휴지통에서 제거

---

## Task 8: Phase 8 commit

```bash
git add services/api/src/trash/dto/ \
        services/api/src/trash/trash.controller.ts \
        services/api/src/trash/trash.controller.spec.ts \
        services/api/src/trash/trash.service.ts \
        services/web/src/features/<trash 사용처>/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 8 — trash 도메인 전환"
```

---

## Phase 8 완료 조건

- [ ] TrashItemDto/TrashListResponseDto/TrashActionBodyDto 작성
- [ ] controller 3 메서드 변환, restore/permanentDelete NO_CONTENT 명시
- [ ] service 시그니처 DTO로
- [ ] web trash 사용처 갱신, invalidation 적용
- [ ] e2e: list/restore/permanentDelete 모두 정상
- [ ] 1 commit

Phase 8 종료. **모든 도메인 전환 완료**. Phase 9 (cleanup) 진입 가능 — packages/contracts 삭제 + 인프라/CLAUDE.md 정리.

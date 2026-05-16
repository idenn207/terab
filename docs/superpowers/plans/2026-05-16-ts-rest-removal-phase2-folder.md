# Phase 2 — folder 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 plan을 참조 원본으로 사용한다 — 패턴(데코레이터 순서·DTO·@ApiError·web wrapper·model 응답 구조)이 동일하다.

**Goal:** folder 도메인(controller 6 메서드)을 표준 NestJS swagger + class-validator로 전환한다. discriminated union 없음.

**Architecture:** folder는 다른 도메인 의존 없음. file/trash가 folder를 의존하므로 Phase 7/8 전에 완료해야 함. 엔드포인트: `getRoot`/`getChildren`/`create`/`rename`/`move`/`remove`.

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 2 — folder 도메인 전환`).

**Spec 참조:** §2, §6.A. Phase 1 plan ([`2026-05-16-ts-rest-removal-phase1-invitation.md`](./2026-05-16-ts-rest-removal-phase1-invitation.md))의 패턴을 그대로 적용.

**전제:** Phase 0/1 완료.

---

## File Structure

### Create (API)
- `services/api/src/folder/dto/folder-item.dto.ts`
- `services/api/src/folder/dto/folder-children-response.dto.ts`
- `services/api/src/folder/dto/create-folder-body.dto.ts`
- `services/api/src/folder/dto/rename-folder-body.dto.ts`
- `services/api/src/folder/dto/move-folder-body.dto.ts`
- `services/api/src/folder/dto/index.ts`

### Modify (API)
- `services/api/src/folder/folder.controller.ts`
- `services/api/src/folder/folder.controller.spec.ts`
- `services/api/src/folder/folder.service.ts` (반환 타입)

### Modify (Web)
- `services/web/src/shared/api/generated/` — codegen 재실행
- `services/web/src/features/{folder 관련 슬라이스}/api/*.ts`
- `services/web/src/features/{folder 관련 슬라이스}/model/*.ts` (응답 구조 변경)

> Web 측 영향 슬라이스는 Task 6에서 grep으로 식별.

---

## Task 1: folder DTO 작성

**Files:**
- Create: `services/api/src/folder/dto/folder-item.dto.ts`
- Create: `services/api/src/folder/dto/folder-children-response.dto.ts`
- Create: `services/api/src/folder/dto/create-folder-body.dto.ts`
- Create: `services/api/src/folder/dto/rename-folder-body.dto.ts`
- Create: `services/api/src/folder/dto/move-folder-body.dto.ts`
- Create: `services/api/src/folder/dto/index.ts`

- [ ] **Step 1: FolderItemDto 작성**

```ts
// services/api/src/folder/dto/folder-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class FolderItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: FolderChildrenResponseDto 작성**

> file.schema의 FileItemSchema를 참조하므로 Phase 7 (file)에서 정의될 `FileItemDto`가 필요하지만, Phase 2 시점에는 아직 없음. 임시로 Phase 2에서 `FileItemDto`를 미리 작성하거나 `services/api/src/file/dto/`에 stub 형태로 생성.

차선책: Phase 2에서 `FileItemDto`도 함께 작성 (file 도메인 controller는 Phase 7에서 변환하되 DTO 정의만 미리 둠).

```ts
// services/api/src/file/dto/file-item.dto.ts (Phase 2에서 선제 생성)
import { ApiProperty } from '@nestjs/swagger';

export class FileItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  size!: number;

  mimeType!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  folderId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
```

> 정확한 FileItemSchema 필드는 `packages/contracts/src/schemas/file.schema.ts` 확인 후 동일하게 작성.

`services/api/src/file/dto/index.ts` 미존재 시 함께 생성:
```ts
export * from './file-item.dto';
```

이후 FolderChildrenResponseDto:
```ts
// services/api/src/folder/dto/folder-children-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { FileItemDto } from '../../file/dto';
import { FolderItemDto } from './folder-item.dto';

export class FolderChildrenResponseDto {
  @ApiProperty({ type: FolderItemDto, isArray: true })
  folders!: FolderItemDto[];

  @ApiProperty({ type: FileItemDto, isArray: true })
  files!: FileItemDto[];
}
```

- [ ] **Step 3: Body DTO들 작성**

```ts
// services/api/src/folder/dto/create-folder-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateFolderBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}
```

```ts
// services/api/src/folder/dto/rename-folder-body.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameFolderBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
```

```ts
// services/api/src/folder/dto/move-folder-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveFolderBodyDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}
```

- [ ] **Step 4: dto/index.ts 진입점**

```ts
// services/api/src/folder/dto/index.ts
export * from './folder-item.dto';
export * from './folder-children-response.dto';
export * from './create-folder-body.dto';
export * from './rename-folder-body.dto';
export * from './move-folder-body.dto';
```

- [ ] **Step 5: 빌드 검증 + EOL**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

EOL: Phase 1 Task 1 Step 6과 동일 방식으로 모든 신규 파일 검증.

---

## Task 2: folder.controller.ts 변환

**Files:**
- Modify: `services/api/src/folder/folder.controller.ts`

- [ ] **Step 1: 기존 컨트롤러 확인**

Run: `cat services/api/src/folder/folder.controller.ts`

- [ ] **Step 2: 전체 재작성**

```ts
// services/api/src/folder/folder.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import {
  CreateFolderBodyDto,
  FolderChildrenResponseDto,
  FolderItemDto,
  MoveFolderBodyDto,
  RenameFolderBodyDto,
} from './dto';
import { FolderService } from './folder.service';

@Controller('folders')
@ApiTags('Folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get('root')
  @ApiOperation({ summary: '루트 폴더 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderChildrenResponseDto })
  async getRoot(@CurrentUser() user: AuthUser): Promise<FolderChildrenResponseDto> {
    return this.folderService.getRoot(user.userId);
  }

  @Get(':id/children')
  @ApiOperation({ summary: '서브폴더 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderChildrenResponseDto })
  @ApiError('FOLDER_NOT_FOUND')
  async getChildren(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderChildrenResponseDto> {
    return this.folderService.getChildren(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: '폴더 생성' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND', 'FOLDER_DEPTH_EXCEEDED')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.create(user.userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '폴더 이름 변경' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.rename(user.userId, id, body);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '폴더 이동' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND', 'INVALID_MOVE_TARGET', 'FOLDER_DEPTH_EXCEEDED')
  async move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.move(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '폴더 소프트 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FOLDER_NOT_FOUND', 'FOLDER_ALREADY_DELETED')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.folderService.remove(user.userId, id);
  }
}
```

**도메인 specifics:**
- 모든 메서드가 인증 필요 (`@Public()` 없음)
- 6개 엔드포인트 중 DELETE만 `@HttpCode(HttpStatus.NO_CONTENT)` 명시 필수, POST는 201 기본이므로 생략
- `@ApiError`는 service에서 실제로 throw하는 ErrorCode를 service 코드 확인 후 정확히 명시 (위 목록은 추정 — 실제 service 파일 점검 후 조정)

- [ ] **Step 3: service에서 실제 던지는 ErrorCode 확인**

Run: `grep -n "ApiException" services/api/src/folder/folder.service.ts`
Expected: 각 메서드의 `throw new ApiException('XXX')` 위치와 키 확인. Task 2 Step 2의 `@ApiError(...)` 목록을 service 실제 throw 키에 맞춰 조정.

- [ ] **Step 4: 빌드 검증**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공

---

## Task 3: folder.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/folder/folder.service.ts`

- [ ] **Step 1: 패턴은 Phase 1 Task 3과 동일**

`import { contract } from '@terab/contract'`와 `import { ServerInferResponseBody } from '@ts-rest/core'` 제거.
DTO import 추가: `import { FolderItemDto, FolderChildrenResponseDto, CreateFolderBodyDto, RenameFolderBodyDto, MoveFolderBodyDto } from './dto';`

- [ ] **Step 2: 각 메서드의 매개변수·반환 타입을 DTO로 교체**

| 메서드 | Before (반환) | After |
|---|---|---|
| getRoot | `ServerInferResponseBody<typeof contract.folder.getRoot>` | `Promise<FolderChildrenResponseDto>` |
| getChildren | 동일 | `Promise<FolderChildrenResponseDto>` |
| create | `ServerInferResponseBody<typeof contract.folder.create>` | `Promise<FolderItemDto>` |
| rename | 동일 | `Promise<FolderItemDto>` |
| move | 동일 | `Promise<FolderItemDto>` |
| remove | `Promise<void>` | 동일 |

| 메서드 | Before (body 매개변수) | After |
|---|---|---|
| create | `body: CreateFolderBody` (Zod 타입) | `body: CreateFolderBodyDto` |
| rename | `body: RenameFolderBody` | `body: RenameFolderBodyDto` |
| move | `body: MoveFolderBody` | `body: MoveFolderBodyDto` |

- [ ] **Step 3: 빌드 + 테스트**

Run: `npm --prefix services/api run build`
Run: `npm --prefix services/api test -- folder`
Expected: 모두 통과

---

## Task 4: folder.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/folder/folder.controller.spec.ts`

- [ ] **Step 1: Phase 1 Task 4 패턴 그대로 적용**

`Test.createTestingModule({ controllers, providers: [{ provide: FolderService, useValue: { ... } }] })` + 각 메서드별 `describe`/`it`.

테스트 케이스 작성 순서 (`.claude/rules/testing.md` 준수):
1. 입력 없음·빈 값 케이스
2. 조회 실패 (FOLDER_NOT_FOUND 등)
3. 권한·상태 불일치 (예: FOLDER_ALREADY_DELETED on remove)
4. 성공 케이스

- [ ] **Step 2: 각 6 메서드에 대해 최소 다음 케이스**

- `getRoot`: 성공 1
- `getChildren`: FOLDER_NOT_FOUND 실패 1 + 성공 1
- `create`: 부모 없음 시 FOLDER_NOT_FOUND, depth 초과 시 FOLDER_DEPTH_EXCEEDED, 성공 1
- `rename`: FOLDER_NOT_FOUND, 성공 1
- `move`: INVALID_MOVE_TARGET, FOLDER_DEPTH_EXCEEDED, 성공 1
- `remove`: FOLDER_ALREADY_DELETED, 성공 1

각 케이스의 mock 설정 + 결과 검증은 service.method를 직접 호출하는 단순 구조. Phase 1 Task 4의 코드 형태 참조.

- [ ] **Step 3: 테스트 실행**

Run: `npm --prefix services/api test -- folder.controller.spec`
Expected: 전체 통과

---

## Task 5: API Phase 2 빌드/검증

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 빌드 + 전체 테스트**

Run: `npm --prefix services/api run build && npm test`
Expected: 모두 통과

- [ ] **Step 2: dev 서버 기동 후 folder 라우트 OpenAPI 등재 확인**

Run (별도): `make api`
Run: `curl -s http://localhost:3000/json | python -c "import sys, json; d=json.load(sys.stdin); print('\n'.join(d['paths'].keys()))" | grep folders`
Expected:
```
/folders
/folders/root
/folders/{id}
/folders/{id}/children
/folders/{id}/move
```

`make api` 종료.

---

## Task 6: Web codegen 재실행 + 영향 슬라이스 식별

**Files:**
- 자동 갱신: `services/web/src/shared/api/generated/`

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `npm --prefix services/web run openapi:codegen`

Expected: types/sdk/@tanstack/react-query.gen.ts에 folder 관련 항목 추가.

- [ ] **Step 2: web에서 ts-rest folder 사용처 식별**

Run: `grep -rln "api\.folder\.\|folderContract\|folder\.contract" services/web/src/`
Expected: folder 관련 slice 목록 (예: `features/folder-list`, `features/folder-create`, `features/folder-rename`, `widgets/folder-toolbar` 등 — 실제 구조에 따라 다름).

- [ ] **Step 3: API 종료**

Ctrl+C로 `make api` 종료.

---

## Task 7: Web folder 관련 슬라이스 갱신

**Files:**
- Modify: Task 6 Step 2에서 식별된 각 슬라이스의 `api/{query,mutation}.ts` + `model/useXxx.ts`

- [ ] **Step 1: 각 슬라이스 `api/` 파일 갱신 패턴**

Phase 1 Task 7과 동일 패턴. ts-rest 시절:
```ts
return api.folder.create.useMutation();
```

hey-api로:
```ts
import { useMutation } from '@tanstack/react-query';
import { createFolderMutation } from '@shared/api';

export function useCreateFolderMutation() {
  return useMutation({ ...createFolderMutation() });
}
```

> 생성된 함수명은 codegen 후 `services/web/src/shared/api/generated/@tanstack/react-query.gen.ts`에서 확인.

- [ ] **Step 2: queryKey가 필요한 query 패턴**

```ts
// 예: features/folder-children/api/query.ts
import { useQuery } from '@tanstack/react-query';
import { getFolderChildrenOptions } from '@shared/api';

export function useFolderChildrenQuery(folderId: string) {
  return useQuery({
    ...getFolderChildrenOptions({ path: { id: folderId } }),
    enabled: !!folderId,
  });
}
```

- [ ] **Step 3: invalidation이 필요한 mutation 패턴**

폴더 생성/이름 변경/이동/삭제 후 부모 폴더의 `getChildren` 캐시 무효화 필요. wrapper 안에서:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFolderMutation } from '@shared/api';

export function useCreateFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createFolderMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderChildren' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderRoot' }] });
    },
  });
}
```

> `_id` prefix는 hey-api의 query key 형태. 실제 값은 generated 파일 검사 후 확인.

- [ ] **Step 4: model 훅의 응답 구조 변경 (`{ body }` → `{ data }`)**

Phase 1 Task 8 패턴. 각 model 파일에서 `data.body.X` → `data.X`로 변경, `data.status` 분기는 `error` 분기로 교체.

- [ ] **Step 5: EOL + 빌드**

Run: `npm --prefix services/web run build`
Expected: 빌드 성공

---

## Task 8: MSW handler 점검

- [ ] **Step 1: folder 관련 인라인 핸들러 검색**

Run: `grep -rn "/folders\|folderContract" services/web/src/ services/web/src/__tests__/`

기존 ts-rest 응답 형태(`{ status: 200, body: ... }`)가 있으면 hey-api 형태(`HttpResponse.json({ folders: [], files: [] })`)로 갱신.

---

## Task 9: Web Phase 2 빌드/테스트/e2e

- [ ] **Step 1: 빌드 + 단위 테스트**

Run: `npm --prefix services/web run build && npm test`
Expected: 통과

- [ ] **Step 2: e2e 흐름 수동 검증**

`make api` + `make web` 후 브라우저에서:
1. 로그인
2. 루트 폴더 조회
3. 폴더 생성
4. 폴더 이름 변경
5. 폴더 이동
6. 폴더 삭제
7. 휴지통에 들어갔는지 (Phase 8에서 정리되지만 ts-rest 잔존 상태로 동작 확인)

Expected: 모든 흐름 정상.

---

## Task 10: Phase 2 commit

- [ ] **Step 1: stage + commit**

```bash
git add services/api/src/folder/dto/ \
        services/api/src/file/dto/ \
        services/api/src/folder/folder.controller.ts \
        services/api/src/folder/folder.controller.spec.ts \
        services/api/src/folder/folder.service.ts \
        services/web/src/features/<folder 슬라이스들>/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 2 — folder 도메인 전환"
```

---

## Phase 2 완료 조건

- [ ] folder DTO 5개 + FileItemDto 선제 생성 완료
- [ ] folder controller 6 메서드 모두 표준 데코레이터로 변환
- [ ] service 시그니처 DTO로 교체
- [ ] controller spec 갱신 (실패 케이스 우선)
- [ ] web codegen 재실행 + folder 사용처 갱신
- [ ] build / test / e2e 통과
- [ ] 1 commit

Phase 3 (trusted-device) 진입 가능.

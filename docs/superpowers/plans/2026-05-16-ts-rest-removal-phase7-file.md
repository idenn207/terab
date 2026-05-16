# Phase 7 — file 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1/2/6 plan을 참조 원본으로 사용.

**Goal:** file 도메인을 표준 NestJS swagger + class-validator로 전환한다. 3개 컨트롤러(`file.controller.ts`, `file-upload.controller.ts`, `file-download.controller.ts`)에 총 9 메서드. presigned URL 업로드 + zip streaming download 포함.

**Architecture:** file 도메인은 가장 큰 도메인. `FileItemDto`는 Phase 2 (folder)에서 선제 작성됨. file-download는 이미 표준 NestJS 패턴(`@Get`/`@Post`/`StreamableFile`)이라 swagger 데코레이터만 추가하면 됨.

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 7 — file 도메인 전환 (upload/download 포함)`).

**Spec 참조:** §2.5 (multipart 매핑 — file은 사실 presigned URL 방식이라 multipart 직접 사용 안 함), §6.A. Phase 1/2/6 plan 패턴.

**전제:** Phase 0~6 완료. folder는 file의 의존이므로 Phase 2 완료 필수.

---

## File Structure

### Create (API)
- `services/api/src/file/dto/rename-file-body.dto.ts`
- `services/api/src/file/dto/move-file-body.dto.ts`
- `services/api/src/file/dto/file-search-query.dto.ts`
- `services/api/src/file/dto/file-search-response.dto.ts`
- `services/api/src/file/dto/upload-init-body.dto.ts`
- `services/api/src/file/dto/upload-init-response.dto.ts` (UploadPartDto 포함)
- `services/api/src/file/dto/upload-complete-body.dto.ts` (UploadCompletePartDto 포함)
- `services/api/src/file/dto/zip-download-body.dto.ts`
- `services/api/src/file/dto/index.ts`

> `file-item.dto.ts`는 Phase 2에서 선제 작성됨.

### Modify (API)
- `services/api/src/file/file.controller.ts` — 5 메서드 변환
- `services/api/src/file/file.controller.spec.ts`
- `services/api/src/file/file.service.ts` (반환 타입)
- `services/api/src/file/file-upload.controller.ts` — 2 메서드 변환
- `services/api/src/file/file-upload.controller.spec.ts`
- `services/api/src/file/upload-session.service.ts` (반환 타입)
- `services/api/src/file/file-download.controller.ts` — swagger 데코레이터만 추가 (라우트는 이미 표준)
- `services/api/src/file/file-download.controller.spec.ts` (있다면 점검)

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/file-upload/api/mutation.ts` (이미 존재)
- `services/web/src/features/file-upload/model/useUploadFile.ts` (응답 구조)
- 기타 file 사용처 (codegen 후 grep으로 식별)

---

## Task 1: 파일 도메인 DTO 작성 (단순 body/response)

**Files:**
- Create: `services/api/src/file/dto/rename-file-body.dto.ts`
- Create: `services/api/src/file/dto/move-file-body.dto.ts`
- Create: `services/api/src/file/dto/file-search-query.dto.ts`
- Create: `services/api/src/file/dto/file-search-response.dto.ts`
- Create: `services/api/src/file/dto/zip-download-body.dto.ts`

- [ ] **Step 1: RenameFileBodyDto**

```ts
// services/api/src/file/dto/rename-file-body.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameFileBodyDto {
  @IsString() @MinLength(1) @MaxLength(255)
  name!: string;
}
```

- [ ] **Step 2: MoveFileBodyDto**

```ts
// services/api/src/file/dto/move-file-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveFileBodyDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  folderId!: string | null;
}
```

- [ ] **Step 3: FileSearchQueryDto + FileSearchResponseDto**

기존 Zod query: `{ q: 2-255, scope: 'all'|'folder', folderId: uuid optional }`.

```ts
// services/api/src/file/dto/file-search-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class FileSearchQueryDto {
  @IsString() @MinLength(2) @MaxLength(255)
  q!: string;

  @ApiProperty({ enum: ['all', 'folder'] })
  @IsEnum(['all', 'folder'])
  scope!: 'all' | 'folder';

  @IsOptional()
  @IsUUID()
  folderId?: string;
}
```

```ts
// services/api/src/file/dto/file-search-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { FileItemDto } from './file-item.dto';

export class FileSearchResponseDto {
  @ApiProperty({ type: FileItemDto, isArray: true })
  files!: FileItemDto[];
}
```

- [ ] **Step 4: ZipDownloadBodyDto**

기존 Zod: `{ fileIds: uuid[] min 1 max 100 }`.

```ts
// services/api/src/file/dto/zip-download-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ZipDownloadBodyDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  fileIds!: string[];
}
```

---

## Task 2: 업로드 세션 DTO 작성

**Files:**
- Create: `services/api/src/file/dto/upload-init-body.dto.ts`
- Create: `services/api/src/file/dto/upload-init-response.dto.ts`
- Create: `services/api/src/file/dto/upload-complete-body.dto.ts`

- [ ] **Step 1: UploadInitBodyDto**

```ts
// services/api/src/file/dto/upload-init-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, MinLength } from 'class-validator';

const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100 GiB

export class UploadInitBodyDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString() @MinLength(1) @MaxLength(255)
  name!: string;

  @ApiProperty({ description: '파일 크기 (byte). 최대 100 GiB' })
  @IsInt() @IsPositive() @Max(MAX_FILE_SIZE)
  size!: number;

  @IsString() @MinLength(1) @MaxLength(127)
  mimeType!: string;
}
```

- [ ] **Step 2: UploadPartDto + UploadInitResponseDto**

```ts
// services/api/src/file/dto/upload-init-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UploadPartDto {
  @ApiProperty({ minimum: 1, maximum: 10000 })
  partNumber!: number;

  @ApiProperty({ format: 'uri' })
  uploadUrl!: string;
}

export class UploadInitResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ type: UploadPartDto, isArray: true, minItems: 1 })
  parts!: UploadPartDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  uploadHeaders!: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}
```

- [ ] **Step 3: UploadCompleteBodyDto**

```ts
// services/api/src/file/dto/upload-complete-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadCompletePartDto {
  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt() @Min(1) @Max(10000)
  partNumber!: number;

  @IsString() @MinLength(1) @MaxLength(128)
  etag!: string;
}

export class UploadCompleteBodyDto {
  @ApiProperty({ type: UploadCompletePartDto, isArray: true, minItems: 1 })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadCompletePartDto)
  parts!: UploadCompletePartDto[];
}
```

> `@Type(() => UploadCompletePartDto)`은 class-transformer가 nested 배열 요소를 클래스 인스턴스로 변환하게 함. `@ValidateNested({ each: true })`로 내부 검증 활성화.

---

## Task 3: dto/index.ts 진입점

**Files:**
- Modify: `services/api/src/file/dto/index.ts` (Phase 2에서 FileItemDto만 있음)

```ts
// services/api/src/file/dto/index.ts
export * from './file-item.dto';
export * from './rename-file-body.dto';
export * from './move-file-body.dto';
export * from './file-search-query.dto';
export * from './file-search-response.dto';
export * from './zip-download-body.dto';
export * from './upload-init-body.dto';
export * from './upload-init-response.dto';
export * from './upload-complete-body.dto';
```

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 4: file.controller.ts 변환 (5 메서드: rename/move/copy/remove/search)

**Files:**
- Modify: `services/api/src/file/file.controller.ts`

- [ ] **Step 1: 기존 컨트롤러 확인**

Run: `cat services/api/src/file/file.controller.ts`

- [ ] **Step 2: 재작성**

```ts
// services/api/src/file/file.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import {
  FileItemDto,
  FileSearchQueryDto,
  FileSearchResponseDto,
  MoveFileBodyDto,
  RenameFileBodyDto,
} from './dto';
import { FileService } from './file.service';

@Controller('files')
@ApiTags('File')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('search')
  @ApiOperation({ summary: '파일 검색' })
  @ApiResponse({ status: HttpStatus.OK, type: FileSearchResponseDto })
  async search(
    @CurrentUser() user: AuthUser,
    @Query() query: FileSearchQueryDto,
  ): Promise<FileSearchResponseDto> {
    return this.fileService.search(user.userId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: '파일 이름 변경' })
  @ApiResponse({ status: HttpStatus.OK, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.rename(user.userId, id, body);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '파일 이동' })
  @ApiResponse({ status: HttpStatus.OK, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.move(user.userId, id, body);
  }

  @Post(':id/copy')
  @ApiOperation({ summary: '파일 복사' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async copy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.copy(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 소프트 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND', 'FILE_ALREADY_DELETED')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.fileService.remove(user.userId, id);
  }
}
```

- [ ] **Step 3: service throw 키 점검**

Run: `grep -n "ApiException" services/api/src/file/file.service.ts`
@ApiError 인자 조정.

- [ ] **Step 4: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 5: file-upload.controller.ts 변환 (2 메서드: uploadInit/uploadComplete)

**Files:**
- Modify: `services/api/src/file/file-upload.controller.ts`

- [ ] **Step 1: 재작성**

```ts
// services/api/src/file/file-upload.controller.ts
import { Body, Controller, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { FileItemDto, UploadCompleteBodyDto, UploadInitBodyDto, UploadInitResponseDto } from './dto';
import { UploadSessionService } from './upload-session.service';

@Controller('files')
@ApiTags('File')
export class FileUploadController {
  constructor(private readonly uploadSessionService: UploadSessionService) {}

  @Post('upload-init')
  @ApiOperation({ summary: '파일 업로드 세션 생성 (presigned URL 발급)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: UploadInitResponseDto })
  @ApiError('FOLDER_NOT_FOUND', 'FILE_TOO_LARGE')
  async init(
    @CurrentUser() user: AuthUser,
    @Body() body: UploadInitBodyDto,
  ): Promise<UploadInitResponseDto> {
    return this.uploadSessionService.init(user.userId, body);
  }

  @Post(':sessionId/upload-complete')
  @ApiOperation({ summary: '파일 업로드 완료 (DB 반영)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FileItemDto })
  @ApiError('UPLOAD_SESSION_NOT_FOUND', 'UPLOAD_SESSION_EXPIRED', 'UPLOAD_OBJECT_MISSING', 'UPLOAD_SIZE_MISMATCH')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: UploadCompleteBodyDto,
  ): Promise<FileItemDto> {
    return this.uploadSessionService.complete(user.userId, sessionId, body.parts);
  }
}
```

> `FileUploadController`도 `@Controller('files')` 사용. NestJS는 같은 prefix를 가진 여러 컨트롤러 허용.

- [ ] **Step 2: service throw 키 점검**

Run: `grep -n "ApiException" services/api/src/file/upload-session.service.ts`
@ApiError 인자 조정.

- [ ] **Step 3: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 6: file-download.controller.ts에 swagger 데코레이터 추가

**Files:**
- Modify: `services/api/src/file/file-download.controller.ts`

file-download는 이미 `@Get`/`@Post`를 사용하는 표준 NestJS 패턴 — **route는 변경하지 않고 swagger 데코레이터만 추가**.

- [ ] **Step 1: 기존 컨트롤러를 swagger 메타로 보강**

```ts
// services/api/src/file/file-download.controller.ts (보강 후)
import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { ZipDownloadBodyDto } from './dto';
import archiver from 'archiver';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { FileService } from './file.service';

@Controller()
@ApiTags('File')
export class FileDownloadController {
  private readonly ZIP_LIMIT = 100;
  constructor(private readonly fileService: FileService) {}

  private lazyStream(factory: () => Promise<Readable>): Readable {
    let source: Readable | null = null;
    let connected = false;
    return new Readable({
      read() {
        if (source) {
          source.resume();
        } else if (!connected) {
          connected = true;
          factory()
            .then((s) => {
              source = s;
              s.on('data', (chunk) => {
                if (!this.push(chunk)) s.pause();
              });
              s.on('end', () => this.push(null));
              s.on('error', (err) => this.destroy(err));
            })
            .catch((err) => this.destroy(err as Error));
        }
      },
    });
  }

  @Get('/files/:id/download')
  @ApiOperation({ summary: '파일 다운로드' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({
    status: HttpStatus.OK,
    schema: { type: 'string', format: 'binary' },
  })
  @ApiError('FILE_NOT_FOUND')
  async downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, name, size, mimeType } = await this.fileService.getDownloadStream(user.userId, id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      'Content-Length': String(size),
    });
    return new StreamableFile(stream);
  }

  @Post('/files/download/zip')
  @ApiOperation({ summary: 'ZIP 다운로드' })
  @ApiProduces('application/zip')
  @ApiResponse({
    status: HttpStatus.OK,
    schema: { type: 'string', format: 'binary' },
  })
  @ApiError('FILE_NOT_FOUND', 'ZIP_LIMIT_EXCEEDED')
  async downloadZip(
    @CurrentUser() user: AuthUser,
    @Body() body: ZipDownloadBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const files = await this.fileService.resolveZipFiles(body.fileIds, user.userId);

    const archive = archiver('zip', { zlib: { level: 1 } });

    for (const { name, key } of files) {
      archive.append(
        this.lazyStream(() => this.fileService.getObjectStream(key)),
        { name },
      );
    }

    void archive.finalize();

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="download.zip"',
    });

    return new StreamableFile(archive);
  }
}
```

**변경 핵심:**
- `@ApiOperation`/`@ApiProduces`/`@ApiResponse`/`@ApiError` 추가
- `body: { fileIds: string[] }` → `body: ZipDownloadBodyDto` (validation 활성화)
- 기존 inline `if (!body.fileIds || body.fileIds.length > this.ZIP_LIMIT) throw ZIP_LIMIT_EXCEEDED` 검증은 DTO의 `@ArrayMaxSize(100)`로 대체 가능. 다만 service 측 검증 유지 가능 — DTO 검증이 ValidationPipe에서 먼저 거름.
- `@Param('id')` → `@Param('id', ParseUUIDPipe)` 추가

- [ ] **Step 2: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 7: file 도메인 service 시그니처 갱신

**Files:**
- Modify: `services/api/src/file/file.service.ts`
- Modify: `services/api/src/file/upload-session.service.ts`

- [ ] **Step 1: file.service.ts 갱신**

`contract`/`ServerInferResponseBody` import 제거. DTO import 추가.

반환 타입:
- `rename`/`move`/`copy`: `Promise<FileItemDto>`
- `remove`: `Promise<void>`
- `search`: `Promise<FileSearchResponseDto>`
- `getDownloadStream`/`resolveZipFiles`/`getObjectStream`: 기존 내부 타입 그대로

매개변수 타입:
- `rename(userId, id, body: RenameFileBodyDto)`
- `move(userId, id, body: MoveFileBodyDto)`
- `copy(userId, id, body: MoveFileBodyDto)`
- `search(userId, query: FileSearchQueryDto)`

- [ ] **Step 2: upload-session.service.ts 갱신**

반환 타입:
- `init`: `Promise<UploadInitResponseDto>`
- `complete`: `Promise<FileItemDto>`

매개변수:
- `init(userId, body: UploadInitBodyDto)`
- `complete(userId, sessionId, parts: UploadCompletePartDto[])` (기존 시그니처 그대로)

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd services/api && npm run build && npm test -- file`
Expected: 통과.

---

## Task 8: file controller spec 갱신

**Files:**
- Modify: `services/api/src/file/file.controller.spec.ts`
- Modify: `services/api/src/file/file-upload.controller.spec.ts`
- Modify: `services/api/src/file/file-download.controller.spec.ts` (있으면)

- [ ] **Step 1: Phase 1 Task 4 패턴**

각 컨트롤러의 메서드별 실패/성공 케이스 작성. 특히:
- file.search: q 길이 위반, scope 잘못된 값 (ValidationPipe 거부)
- file.rename/move/copy/remove: FILE_NOT_FOUND, FOLDER_NOT_FOUND, FILE_ALREADY_DELETED 실패 + 성공
- upload init: FILE_TOO_LARGE, FOLDER_NOT_FOUND + 성공
- upload complete: UPLOAD_SESSION_NOT_FOUND, UPLOAD_SESSION_EXPIRED, UPLOAD_SIZE_MISMATCH + 성공
- download: FILE_NOT_FOUND + 성공 (StreamableFile 반환 검증)
- downloadZip: ZIP_LIMIT_EXCEEDED, FILE_NOT_FOUND + 성공

- [ ] **Step 2: 테스트 실행**

Run: `cd services/api && npm test -- file`
Expected: 전체 통과.

---

## Task 9: API Phase 7 검증

Run: `cd services/api && npm run build && npm test`
Expected: 통과.

`make api` 후 `/json`에서 file 관련 경로 확인:
```
/files
/files/{id}
/files/{id}/copy
/files/{id}/download
/files/{id}/move
/files/{sessionId}/upload-complete
/files/download/zip
/files/search
/files/upload-init
```

`make api` 종료.

---

## Task 10: Web codegen + features 갱신

**Files:**
- Modify: `services/web/src/features/file-upload/api/mutation.ts`
- Modify: `services/web/src/features/file-upload/model/useUploadFile.ts`
- 기타 file 사용처

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `cd services/web && npm run openapi:codegen`

- [ ] **Step 2: file 사용처 식별**

Run: `grep -rln "api\.file\.\|fileContract\|file\.contract" services/web/src/`

- [ ] **Step 3: features/file-upload/api/mutation.ts 갱신**

```ts
// services/web/src/features/file-upload/api/mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  uploadInitMutation,
  uploadCompleteMutation,
  getFolderChildrenOptions,    // Phase 2에서 도입
} from '@shared/api';

export function useUploadInitMutation() {
  return useMutation({ ...uploadInitMutation() });
}

export function useUploadCompleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...uploadCompleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderChildren' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getFolderRoot' }] });
    },
  });
}
```

> 정확한 query key prefix는 generated 검사 후 조정.

- [ ] **Step 4: features/file-upload/model/useUploadFile.ts 갱신**

기존 ts-rest 응답 구조(`{ status, body }`) → hey-api(`{ data }`). presigned URL 업로드 흐름:

```ts
// 흐름:
// 1. uploadInit → presigned parts 받기
// 2. 각 part를 presigned URL에 직접 PUT (axiosInstance 사용 안 함 — pure axios 또는 fetch)
// 3. uploadComplete → DB 반영
```

기존 코드의 응답 처리 부분:
- `init.data.body.parts` → `init.data.parts`
- `init.data.body.sessionId` → `init.data.sessionId`
- `init.data.body.uploadHeaders` → `init.data.uploadHeaders`
- `init.data.status === 201` → 단순 성공/실패 분기 (try/catch 또는 onSuccess)

- [ ] **Step 5: 기타 file 사용처 갱신**

`features/file-list`, `features/file-search`, `features/file-delete`, `features/file-rename`, `features/file-move`, `features/file-download` 등 (실제 슬라이스 구조에 따라 다름). 각 슬라이스에 대해:
- `api/{query,mutation}.ts` 갱신
- `model/useXxx.ts`의 응답 구조 변경

- [ ] **Step 6: 빌드 + 테스트**

Run: `cd services/web && npm run build && npm test`
Expected: 통과.

---

## Task 11: e2e — file 흐름 전체 검증

`make api` + `make web` 후:
1. **업로드**: 파일 선택 → uploadInit → presigned URL로 part 업로드 → uploadComplete → 파일 목록에 등장
2. **이름 변경**: rename → 목록에 반영
3. **이동**: 다른 폴더로 이동 → 양쪽 폴더 목록 invalidate
4. **복사**: 복사본 생성 → 대상 폴더에 등장
5. **삭제**: 소프트 삭제 → 휴지통으로 이동 (Phase 8에서 정리되지만 ts-rest 잔존이라 동작 확인)
6. **검색**: 키워드 입력 → 결과 표시
7. **다운로드 (단일)**: 파일 다운로드 → 정확한 mimeType + 파일명
8. **ZIP 다운로드**: 여러 파일 선택 → ZIP 다운로드 → archiver streaming 정상

각 흐름에서 응답 구조 변경(`body` → `data`)이 정상 반영되는지 확인.

---

## Task 12: Phase 7 commit

```bash
git add services/api/src/file/dto/ \
        services/api/src/file/file.controller.ts \
        services/api/src/file/file.controller.spec.ts \
        services/api/src/file/file.service.ts \
        services/api/src/file/file-upload.controller.ts \
        services/api/src/file/file-upload.controller.spec.ts \
        services/api/src/file/upload-session.service.ts \
        services/api/src/file/file-download.controller.ts \
        services/web/src/features/<file 사용처>/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 7 — file 도메인 전환 (upload/download 포함)"
```

---

## Phase 7 완료 조건

- [ ] file/upload/download 9 메서드 모두 변환 또는 swagger 데코레이터 추가
- [ ] DTO 8개 신규 작성 (file-item.dto는 Phase 2 선제 완료)
- [ ] service 시그니처 DTO로 교체
- [ ] /json에서 file 관련 9개 path 등재 확인
- [ ] web file 사용처 모두 갱신, invalidation 적용
- [ ] e2e: 업로드/이름변경/이동/복사/삭제/검색/다운로드/ZIP 다운로드 모두 정상
- [ ] 1 commit

Phase 8 (trash) 진입 가능.

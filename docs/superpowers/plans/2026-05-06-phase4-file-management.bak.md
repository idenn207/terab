# Phase 4 파일 관리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파일·폴더 CRUD, 업로드/다운로드, 이동/복사/검색, 소프트 삭제·휴지통 API를 구현한다 (DEV-019~025 + DEV-028 기본).

**Architecture:** API 서버 Proxy 방식(multer `MinioStorageEngine` 스트리밍 → MinIO)으로 파일을 업로드하고, Adjacency List (`parent_id`) 기반 폴더 트리를 PostgreSQL로 관리한다. 폴더 목록 조회는 Redis 캐시(NestJS cache-manager)로 가속하며, 캐시 무효화는 쓰기 작업 직후 서비스 레이어에서 처리한다.

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL 16, MinIO (`minio` npm), multer (via `@nestjs/platform-express`), archiver, @nestjs/cache-manager + cache-manager-ioredis-yet, Redis (기존 인스턴스 공용)

---

## 파일 구조

```
packages/contracts/src/
  schemas/
    folder.schema.ts       (신규) — FolderItem, FolderChildrenResponse Zod 스키마
    file.schema.ts         (신규) — FileItem, FileResponse 스키마
    trash.schema.ts        (신규) — TrashItem, TrashListResponse 스키마
  contracts/
    folder.contract.ts     (신규) — 6개 폴더 엔드포인트
    file.contract.ts       (신규) — 8개 파일 엔드포인트 (다운로드 제외)
    trash.contract.ts      (신규) — 3개 휴지통 엔드포인트
    index.ts               (수정) — folder, file, trash 추가

services/api/src/
  database/schema/
    folders.schema.ts      (신규) — folders Drizzle 스키마
    files.schema.ts        (신규) — files Drizzle 스키마
    index.ts               (수정) — 두 스키마 re-export
  common/exceptions/
    error-code.enum.ts     (수정) — FILE_*, FOLDER_*, ZIP_* 에러 코드 추가
  minio/
    minio.module.ts        (신규) — Global 모듈
    minio.service.ts       (신규) — putObject, getObject, copyObject, removeObject
    minio-storage.engine.ts (신규) — multer StorageEngine, MinIO 직접 스트리밍
    minio.service.spec.ts  (신규)
  folder/
    folder.module.ts       (신규)
    folder.controller.ts   (신규) — ts-rest 핸들러 (루트 목록, 서브폴더, CRUD)
    folder.service.ts      (신규)
    folder.repository.ts   (신규) — findRoot, findChildren, insert, rename, move, softDeleteCascade
    folder.controller.spec.ts
    folder.service.spec.ts
    folder.repository.spec.ts
  file/
    file.module.ts         (신규)
    file.controller.ts     (신규) — ts-rest 핸들러 (업로드, 이름변경, 이동, 복사, 삭제, 검색)
    file-download.controller.ts (신규) — 표준 NestJS 핸들러 (단일/ZIP 다운로드)
    file.service.ts        (신규)
    file.repository.ts     (신규)
    file.controller.spec.ts
    file-download.controller.spec.ts
    file.service.spec.ts
    file.repository.spec.ts
  trash/
    trash.module.ts        (신규)
    trash.controller.ts    (신규)
    trash.service.ts       (신규)
    trash.repository.ts    (신규) — files + folders 양쪽 쿼리, 소프트 삭제 CTE
    trash.controller.spec.ts
    trash.service.spec.ts
    trash.repository.spec.ts
  app.module.ts            (수정) — CacheModule, FolderModule, FileModule, TrashModule 등록
```

---

## Task 1: 의존성 설치

**Files:**
- Modify: `services/api/package.json`

- [ ] **Step 1: npm 패키지 설치**

```bash
cd services/api
npm install minio archiver @nestjs/cache-manager cache-manager cache-manager-ioredis-yet
npm install --save-dev @types/multer @types/minio @types/archiver
```

> **Note:** `multer`는 `@nestjs/platform-express`에 포함되어 있으므로 별도 설치 불필요. `@types/multer`만 추가한다.

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add services/api/package.json services/api/package-lock.json
git commit -m "chore: Phase 4 의존성 추가 (busboy, minio, archiver, cache-manager)"
```

---

## Task 2: DB 스키마 — folders

**Files:**
- Create: `services/api/src/database/schema/folders.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`

- [ ] **Step 1: folders.schema.ts 작성**

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const folders = table(
  'folders',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t.uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    parentId: t.uuid('parent_id').references((): ReturnType<typeof t.uuid> => folders.id, { onDelete: 'cascade' }),
    name: t.varchar('name', { length: 255 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.userId),
    t.index().on(table.parentId),
  ],
);

export type Folders$Insert = typeof folders.$inferInsert;
export type Folders$Select = typeof folders.$inferSelect;
```

- [ ] **Step 2: schema/index.ts에 re-export 추가**

기존 `index.ts` 하단에 추가:

```ts
export * from './folders.schema';
```

- [ ] **Step 3: 마이그레이션 생성 및 적용**

```bash
cd services/api
npm run db:generate
npm run db:push
```

Expected: `drizzle/` 디렉토리에 마이그레이션 파일 생성, DB에 `folders` 테이블 생성.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/database/schema/folders.schema.ts services/api/src/database/schema/index.ts services/api/drizzle/
git commit -m "feat: folders 테이블 스키마 추가"
```

---

## Task 3: DB 스키마 — files

**Files:**
- Create: `services/api/src/database/schema/files.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`

- [ ] **Step 1: files.schema.ts 작성**

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { folders } from './folders.schema';

export const files = table(
  'files',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t.uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    folderId: t.uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
    name: t.varchar('name', { length: 255 }).notNull(),
    minioKey: t.varchar('minio_key', { length: 512 }).notNull().unique(),
    size: t.bigint('size', { mode: 'number' }).notNull(),
    mimeType: t.varchar('mime_type', { length: 127 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.userId),
    t.index().on(table.folderId),
    t.index().on(table.name),
  ],
);

export type Files$Insert = typeof files.$inferInsert;
export type Files$Select = typeof files.$inferSelect;
```

- [ ] **Step 2: schema/index.ts에 re-export 추가**

```ts
export * from './files.schema';
```

- [ ] **Step 3: 마이그레이션 생성 및 적용**

```bash
npm run db:generate
npm run db:push
```

Expected: DB에 `files` 테이블 생성.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/database/schema/files.schema.ts services/api/src/database/schema/index.ts services/api/drizzle/
git commit -m "feat: files 테이블 스키마 추가"
```

---

## Task 4: ErrorCode 추가

**Files:**
- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1: ErrorCode 객체에 항목 추가**

기존 `ErrorCode` 객체의 마지막 항목 뒤에 추가:

```ts
  FILE_NOT_FOUND: {
    message: '파일을 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  FOLDER_NOT_FOUND: {
    message: '폴더를 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  FILE_UPLOAD_FAILED: {
    message: '파일 업로드에 실패했습니다.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  FILE_ALREADY_DELETED: {
    message: '이미 삭제된 파일입니다.',
    status: HttpStatus.CONFLICT,
  },
  FOLDER_ALREADY_DELETED: {
    message: '이미 삭제된 폴더입니다.',
    status: HttpStatus.CONFLICT,
  },
  INVALID_MOVE_TARGET: {
    message: '하위 폴더로 이동할 수 없습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  ZIP_LIMIT_EXCEEDED: {
    message: 'ZIP 다운로드는 최대 100개까지 가능합니다.',
    status: HttpStatus.BAD_REQUEST,
  },
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat: 파일 관리 ErrorCode 추가"
```

---

## Task 5: MinIO 모듈

**Files:**
- Create: `services/api/src/minio/minio.module.ts`
- Create: `services/api/src/minio/minio.service.ts`
- Create: `services/api/src/minio/minio-storage.engine.ts`
- Create: `services/api/src/minio/minio.service.spec.ts`
- Modify: `api.env.example`

- [ ] **Step 1: minio.service.spec.ts 작성 (실패하는 테스트)**

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                MINIO_ENDPOINT: 'localhost:9000',
                MINIO_ROOT_USER: 'minioadmin',
                MINIO_ROOT_PASSWORD: 'minioadmin',
                MINIO_DEFAULT_BUCKETS: 'drive',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(MinioService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('bucketName이 환경변수에서 로드된다', () => {
    expect(service.bucketName).toBe('drive');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest minio.service.spec.ts
```

Expected: FAIL — MinioService not found.

- [ ] **Step 3: minio.service.ts 작성**

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService {
  private readonly client: Client;
  readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.getOrThrow<string>('MINIO_ENDPOINT');
    const [host, portStr] = endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.client = new Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    this.bucketName = config.getOrThrow<string>('MINIO_DEFAULT_BUCKETS');
  }

  async putObject(key: string, stream: Readable, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucketName, key, stream, undefined, {
      'Content-Type': mimeType,
    });
  }

  async getObject(key: string): Promise<Readable> {
    return this.client.getObject(this.bucketName, key);
  }

  async statObject(key: string): Promise<{ size: number }> {
    const stat = await this.client.statObject(this.bucketName, key);
    return { size: stat.size };
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const source = new (await import('minio')).CopySourceOptions({
      Bucket: this.bucketName,
      Object: sourceKey,
    });
    const dest = new (await import('minio')).CopyDestinationOptions({
      Bucket: this.bucketName,
      Object: destKey,
    });
    await this.client.copyObject(dest, source);
  }

  async removeObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucketName, key);
  }

  async removeObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.removeObjects(this.bucketName, keys);
  }
}
```

- [ ] **Step 4: minio-storage.engine.ts 작성**

```ts
import { StorageEngine } from 'multer';
import { Request } from 'express';
import { PassThrough } from 'stream';
import { randomUUID } from 'crypto';
import { MinioService } from './minio.service';

export class MinioStorageEngine implements StorageEngine {
  constructor(private readonly minioService: MinioService) {}

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const userId = (req as any).user?.userId;
    if (!userId) return cb(new Error('Unauthenticated'));

    const key = `${userId}/${randomUUID()}`;
    const counter = new PassThrough();
    let size = 0;
    counter.on('data', (chunk: Buffer) => { size += chunk.length; });
    file.stream.pipe(counter);

    this.minioService
      .putObject(key, counter, file.mimetype)
      .then(() => cb(null, { filename: key, size }))
      .catch(cb);
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ): void {
    this.minioService.removeObject(file.filename).then(() => cb(null)).catch(cb);
  }
}
```

> **Note:** `cb(null, { filename: key, size })`로 반환한 값이 `Express.Multer.File` 객체에 병합된다. 컨트롤러에서 `@UploadedFile()`로 받은 파일 객체의 `filename`이 MinIO key, `size`가 실제 바이트 수가 된다.

- [ ] **Step 5: minio.module.ts 작성**

```ts
import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';

@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
npx jest minio.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: api.env.example 업데이트**

`api.env.example`의 MinIO 섹션을 다음으로 교체:

```
# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
MINIO_DEFAULT_BUCKETS=drive
```

- [ ] **Step 8: Commit**

```bash
git add services/api/src/minio/ api.env.example
git commit -m "feat: MinIO 전역 모듈 및 스토리지 엔진 추가"
```

---

## Task 6: Redis 캐시 모듈 설정

**Files:**
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: app.module.ts에 CacheModule 등록**

기존 `imports` 배열에 추가 (BullModule 뒤에 삽입):

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
```

그리고 `imports` 배열에:

```ts
CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    stores: [createKeyv(config.getOrThrow<string>('REDIS_URL'))],
    ttl: 60_000,
  }),
}),
MinioModule,
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/app.module.ts
git commit -m "feat: Redis CacheModule 전역 등록"
```

---

## Task 7: Contract 스키마

**Files:**
- Create: `packages/contracts/src/schemas/folder.schema.ts`
- Create: `packages/contracts/src/schemas/file.schema.ts`
- Create: `packages/contracts/src/schemas/trash.schema.ts`
- Modify: `packages/contracts/src/schemas/index.ts`

- [ ] **Step 1: folder.schema.ts 작성**

```ts
import z from 'zod';

export const FolderItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const FolderChildrenResponseSchema = z.object({
  folders: z.array(FolderItemSchema),
  files: z.array(z.lazy(() => FileItemSchema)),
});

export const CreateFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

export const RenameFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const MoveFolderBodySchema = z.object({
  parentId: z.string().uuid().nullable(),
});

export type FolderItem = z.infer<typeof FolderItemSchema>;
export type FolderChildrenResponse = z.infer<typeof FolderChildrenResponseSchema>;
export type CreateFolderBody = z.infer<typeof CreateFolderBodySchema>;
export type RenameFolderBody = z.infer<typeof RenameFolderBodySchema>;
export type MoveFolderBody = z.infer<typeof MoveFolderBodySchema>;

import { FileItemSchema } from './file.schema';
```

> **Note:** `FolderChildrenResponse`가 `FileItemSchema`를 참조하므로 두 파일 간 순환 참조가 생긴다. `z.lazy()`로 해결하거나 `FileItemSchema`를 `common.schema.ts`로 이동해도 된다. 아래 file.schema.ts를 먼저 작성한 뒤 import를 조정한다.

- [ ] **Step 2: file.schema.ts 작성**

```ts
import z from 'zod';

export const FileItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  folderId: z.string().uuid().nullable(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const RenameFileBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const MoveFileBodySchema = z.object({
  folderId: z.string().uuid().nullable(),
});

export const ZipDownloadBodySchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(100),
});

export const FileSearchQuerySchema = z.object({
  q: z.string().min(2).max(255),
  scope: z.enum(['all', 'folder']),
  folderId: z.string().uuid().optional(),
});

export const FileSearchResponseSchema = z.object({
  files: z.array(FileItemSchema),
});

export type FileItem = z.infer<typeof FileItemSchema>;
export type RenameFileBody = z.infer<typeof RenameFileBodySchema>;
export type MoveFileBody = z.infer<typeof MoveFileBodySchema>;
export type ZipDownloadBody = z.infer<typeof ZipDownloadBodySchema>;
export type FileSearchQuery = z.infer<typeof FileSearchQuerySchema>;
export type FileSearchResponse = z.infer<typeof FileSearchResponseSchema>;
```

- [ ] **Step 3: folder.schema.ts 순환 참조 해결**

`FolderChildrenResponseSchema`의 `z.lazy(...)` 대신 직접 import를 사용:

```ts
import z from 'zod';
import { FileItemSchema } from './file.schema';

export const FolderItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const FolderChildrenResponseSchema = z.object({
  folders: z.array(FolderItemSchema),
  files: z.array(FileItemSchema),
});

export const CreateFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

export const RenameFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const MoveFolderBodySchema = z.object({
  parentId: z.string().uuid().nullable(),
});

export type FolderItem = z.infer<typeof FolderItemSchema>;
export type FolderChildrenResponse = z.infer<typeof FolderChildrenResponseSchema>;
export type CreateFolderBody = z.infer<typeof CreateFolderBodySchema>;
export type RenameFolderBody = z.infer<typeof RenameFolderBodySchema>;
export type MoveFolderBody = z.infer<typeof MoveFolderBodySchema>;
```

- [ ] **Step 4: trash.schema.ts 작성**

```ts
import z from 'zod';

export const TrashItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['file', 'folder']),
  name: z.string(),
  deletedAt: z.coerce.date(),
});

export const TrashListResponseSchema = z.object({
  items: z.array(TrashItemSchema),
});

export const TrashActionBodySchema = z.object({
  type: z.enum(['file', 'folder']),
});

export type TrashItem = z.infer<typeof TrashItemSchema>;
export type TrashListResponse = z.infer<typeof TrashListResponseSchema>;
export type TrashActionBody = z.infer<typeof TrashActionBodySchema>;
```

- [ ] **Step 5: schemas/index.ts에 re-export 추가**

기존 `index.ts` 하단에 추가:

```ts
export * from './folder.schema';
export * from './file.schema';
export * from './trash.schema';
```

- [ ] **Step 6: 빌드 확인**

```bash
cd packages/contracts && npm run build
```

Expected: 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/schemas/
git commit -m "feat: 파일 관리 contract 스키마 추가 (folder, file, trash)"
```

---

## Task 8: folder.contract.ts

**Files:**
- Create: `packages/contracts/src/contracts/folder.contract.ts`
- Modify: `packages/contracts/src/contracts/index.ts`

- [ ] **Step 1: folder.contract.ts 작성**

```ts
import { HttpStatus } from '@terab/common';
import { EmptySchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';
import {
  CreateFolderBodySchema,
  FolderChildrenResponseSchema,
  FolderItemSchema,
  MoveFolderBodySchema,
  RenameFolderBodySchema,
} from '../schemas/folder.schema';

const c = initContract();

const getRoot = c.query({
  summary: '루트 폴더 목록 조회',
  method: 'GET',
  path: '/folders/root',
  responses: {
    [HttpStatus.OK]: FolderChildrenResponseSchema,
  },
  strictStatusCodes: true,
});

const getChildren = c.query({
  summary: '서브폴더 목록 조회',
  method: 'GET',
  path: '/folders/:id/children',
  pathParams: z.object({ id: z.string().uuid() }),
  responses: {
    [HttpStatus.OK]: FolderChildrenResponseSchema,
  },
  strictStatusCodes: true,
});

const create = c.mutation({
  summary: '폴더 생성',
  method: 'POST',
  path: '/folders',
  contentType: 'application/json',
  body: CreateFolderBodySchema,
  responses: {
    [HttpStatus.CREATED]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const rename = c.mutation({
  summary: '폴더 이름 변경',
  method: 'PATCH',
  path: '/folders/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: RenameFolderBodySchema,
  responses: {
    [HttpStatus.OK]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const move = c.mutation({
  summary: '폴더 이동',
  method: 'PATCH',
  path: '/folders/:id/move',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: MoveFolderBodySchema,
  responses: {
    [HttpStatus.OK]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '폴더 소프트 삭제',
  method: 'DELETE',
  path: '/folders/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const folderContract = c.router({ getRoot, getChildren, create, rename, move, remove });
```

- [ ] **Step 2: contracts/index.ts 업데이트**

```ts
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { folderContract } from './folder.contract';
import { invitationContract } from './invitation.contract';
import { trustedDeviceContract } from './trusted-device.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
  trustedDevice: trustedDeviceContract,
  folder: folderContract,
});

export { authContract, deviceContract, folderContract, invitationContract, trustedDeviceContract, twofaContract };
```

- [ ] **Step 3: 빌드 확인**

```bash
cd packages/contracts && npm run build
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/contracts/folder.contract.ts packages/contracts/src/contracts/index.ts
git commit -m "feat: folder contract 추가"
```

---

## Task 9: file.contract.ts + trash.contract.ts

**Files:**
- Create: `packages/contracts/src/contracts/file.contract.ts`
- Create: `packages/contracts/src/contracts/trash.contract.ts`
- Modify: `packages/contracts/src/contracts/index.ts`

- [ ] **Step 1: file.contract.ts 작성**

업로드·이름변경·이동·복사·삭제·검색 엔드포인트. 다운로드는 바이너리 스트림이므로 contract 제외 (FileDownloadController에서 표준 NestJS 라우팅으로 처리).

```ts
import { HttpStatus } from '@terab/common';
import { EmptySchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';
import {
  FileItemSchema,
  FileSearchQuerySchema,
  FileSearchResponseSchema,
  MoveFileBodySchema,
  RenameFileBodySchema,
} from '../schemas/file.schema';

const c = initContract();

const upload = c.mutation({
  summary: '파일 업로드',
  method: 'POST',
  path: '/files',
  contentType: 'multipart/form-data',
  body: z.object({
    file: z.any(),
    folderId: z.string().uuid().optional(),
  }),
  responses: {
    [HttpStatus.CREATED]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const rename = c.mutation({
  summary: '파일 이름 변경',
  method: 'PATCH',
  path: '/files/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: RenameFileBodySchema,
  responses: {
    [HttpStatus.OK]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const move = c.mutation({
  summary: '파일 이동',
  method: 'PATCH',
  path: '/files/:id/move',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: MoveFileBodySchema,
  responses: {
    [HttpStatus.OK]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const copy = c.mutation({
  summary: '파일 복사',
  method: 'POST',
  path: '/files/:id/copy',
  pathParams: z.object({ id: z.string().uuid() }),
  body: MoveFileBodySchema,
  responses: {
    [HttpStatus.CREATED]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '파일 소프트 삭제',
  method: 'DELETE',
  path: '/files/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const search = c.query({
  summary: '파일 검색',
  method: 'GET',
  path: '/files/search',
  query: FileSearchQuerySchema,
  responses: {
    [HttpStatus.OK]: FileSearchResponseSchema,
  },
  strictStatusCodes: true,
});

export const fileContract = c.router({ upload, rename, move, copy, remove, search });
```

- [ ] **Step 2: trash.contract.ts 작성**

```ts
import { HttpStatus } from '@terab/common';
import { EmptySchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';
import { TrashActionBodySchema, TrashListResponseSchema } from '../schemas/trash.schema';

const c = initContract();

const list = c.query({
  summary: '휴지통 목록 조회',
  method: 'GET',
  path: '/trash',
  responses: {
    [HttpStatus.OK]: TrashListResponseSchema,
  },
  strictStatusCodes: true,
});

const restore = c.mutation({
  summary: '휴지통 항목 복원',
  method: 'POST',
  path: '/trash/:id/restore',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: TrashActionBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const permanentDelete = c.mutation({
  summary: '영구 삭제',
  method: 'DELETE',
  path: '/trash/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: TrashActionBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const trashContract = c.router({ list, restore, permanentDelete });
```

- [ ] **Step 3: contracts/index.ts 업데이트**

```ts
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { fileContract } from './file.contract';
import { folderContract } from './folder.contract';
import { invitationContract } from './invitation.contract';
import { trashContract } from './trash.contract';
import { trustedDeviceContract } from './trusted-device.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
  trustedDevice: trustedDeviceContract,
  folder: folderContract,
  file: fileContract,
  trash: trashContract,
});

export {
  authContract, deviceContract, fileContract, folderContract,
  invitationContract, trashContract, trustedDeviceContract, twofaContract,
};
```

- [ ] **Step 4: contracts 패키지 최종 빌드**

```bash
cd packages/contracts && npm run build
```

Expected: dist/ 생성, 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/contracts/
git commit -m "feat: file·trash contract 추가"
```

---

## Task 10: Folder Repository

**Files:**
- Create: `services/api/src/folder/folder.repository.ts`
- Create: `services/api/src/folder/folder.repository.spec.ts`

- [ ] **Step 1: folder.repository.spec.ts 작성 (실패하는 테스트)**

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { FolderRepository } from './folder.repository';

describe('FolderRepository', () => {
  let repo: FolderRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FolderRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();
    repo = module.get(FolderRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  it('findRootChildren은 userId로 루트 항목을 조회한다', async () => {
    const { mockDbLimit } = await import('@terab/test');
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findRootChildren('user-1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest folder.repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: folder.repository.ts 작성**

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, files, folders, Folders$Insert, Folders$Select } from '@terab/db';
import { and, eq, isNull, sql } from 'drizzle-orm';

@Injectable()
export class FolderRepository {
  constructor(private readonly database: DatabaseService) {}

  async findRootChildren(userId: string): Promise<Folders$Select[]> {
    return this.database.db
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), isNull(folders.parentId), isNull(folders.softDeletedAt)));
  }

  async findChildren(folderId: string, userId: string): Promise<Folders$Select[]> {
    return this.database.db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.parentId, folderId),
          isNull(folders.softDeletedAt),
        ),
      );
  }

  async findByIdAndUser(id: string, userId: string): Promise<Folders$Select | null> {
    const [row = null] = await this.database.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .limit(1);
    return row;
  }

  async insert(data: Pick<Folders$Insert, 'userId' | 'name' | 'parentId'>): Promise<Folders$Select> {
    const [row] = await this.database.db.insert(folders).values(data).returning();
    return row;
  }

  async rename(id: string, userId: string, name: string): Promise<Folders$Select | null> {
    const [row = null] = await this.database.db
      .update(folders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .returning();
    return row;
  }

  async move(id: string, userId: string, parentId: string | null): Promise<Folders$Select | null> {
    const [row = null] = await this.database.db
      .update(folders)
      .set({ parentId, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.softDeletedAt)))
      .returning();
    return row;
  }

  async isDescendant(folderId: string, potentialAncestorId: string): Promise<boolean> {
    const result = await this.database.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f
        INNER JOIN ancestors a ON f.id = a.parent_id
      )
      SELECT 1 FROM ancestors WHERE id = ${potentialAncestorId} LIMIT 1
    `);
    return (result as unknown[]).length > 0;
  }

  async softDeleteCascade(id: string, userId: string): Promise<void> {
    const now = new Date();
    await this.database.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      UPDATE folders SET soft_deleted_at = ${now}
      WHERE id IN (SELECT id FROM subtree)
    `);

    await this.database.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      UPDATE files SET soft_deleted_at = ${now}
      WHERE folder_id IN (SELECT id FROM subtree)
    `);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest folder.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/folder/
git commit -m "feat: FolderRepository 구현"
```

---

## Task 11: Folder Service

**Files:**
- Create: `services/api/src/folder/folder.service.ts`
- Create: `services/api/src/folder/folder.service.spec.ts`

- [ ] **Step 1: folder.service.spec.ts 작성**

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

const mockFolderRepository = {
  findRootChildren: jest.fn(),
  findChildren: jest.fn(),
  findByIdAndUser: jest.fn(),
  insert: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  isDescendant: jest.fn(),
  softDeleteCascade: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockFileRepository = {
  findByFolder: jest.fn(),
  findRootFiles: jest.fn(),
};

describe('FolderService', () => {
  let service: FolderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FolderService,
        { provide: FolderRepository, useValue: mockFolderRepository },
        { provide: 'FileRepository', useValue: mockFileRepository },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();
    service = module.get(FolderService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('getRoot는 캐시 미스 시 DB를 조회하고 캐시를 저장한다', async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockFolderRepository.findRootChildren.mockResolvedValue([]);
    mockFileRepository.findRootFiles.mockResolvedValue([]);

    const result = await service.getRoot('user-1');

    expect(mockFolderRepository.findRootChildren).toHaveBeenCalledWith('user-1');
    expect(mockCacheManager.set).toHaveBeenCalled();
    expect(result).toEqual({ folders: [], files: [] });
  });

  it('getRoot는 캐시 히트 시 DB를 조회하지 않는다', async () => {
    const cached = { folders: [], files: [] };
    mockCacheManager.get.mockResolvedValue(cached);

    const result = await service.getRoot('user-1');

    expect(mockFolderRepository.findRootChildren).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it('create는 parentId가 없으면 루트에 폴더를 생성한다', async () => {
    const folder = { id: 'f1', name: 'test', parentId: null, userId: 'u1', createdAt: new Date(), updatedAt: new Date(), softDeletedAt: null };
    mockFolderRepository.insert.mockResolvedValue(folder);

    const result = await service.create('u1', 'test', undefined);

    expect(mockFolderRepository.insert).toHaveBeenCalledWith({ userId: 'u1', name: 'test', parentId: null });
    expect(result.name).toBe('test');
  });

  it('remove는 폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
    mockFolderRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(service.remove('f1', 'u1')).rejects.toThrow(ApiException);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest folder.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: folder.service.ts 작성**

```ts
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import type { FileItem, FolderChildrenResponse, FolderItem } from '@terab/contract';
import type { Folders$Select } from '@terab/db';
import { FileRepository } from '../file/file.repository';
import { FolderRepository } from './folder.repository';

@Injectable()
export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly fileRepository: FileRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private cacheKey(userId: string, folderId: string | null): string {
    return `files:user:${userId}:folder:${folderId ?? 'root'}`;
  }

  private async invalidate(userId: string, folderId: string | null): Promise<void> {
    await this.cache.del(this.cacheKey(userId, folderId));
  }

  private toFolderItem(row: Folders$Select): FolderItem {
    return { id: row.id, name: row.name, parentId: row.parentId ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  async getRoot(userId: string): Promise<FolderChildrenResponse> {
    const key = this.cacheKey(userId, null);
    const cached = await this.cache.get<FolderChildrenResponse>(key);
    if (cached) return cached;

    const [folderRows, fileRows] = await Promise.all([
      this.folderRepository.findRootChildren(userId),
      this.fileRepository.findRootFiles(userId),
    ]);
    const result: FolderChildrenResponse = {
      folders: folderRows.map((f) => this.toFolderItem(f)),
      files: fileRows.map((f) => this.fileRepository.toFileItem(f)),
    };
    await this.cache.set(key, result);
    return result;
  }

  async getChildren(folderId: string, userId: string): Promise<FolderChildrenResponse> {
    const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');

    const key = this.cacheKey(userId, folderId);
    const cached = await this.cache.get<FolderChildrenResponse>(key);
    if (cached) return cached;

    const [folderRows, fileRows] = await Promise.all([
      this.folderRepository.findChildren(folderId, userId),
      this.fileRepository.findByFolder(folderId, userId),
    ]);
    const result: FolderChildrenResponse = {
      folders: folderRows.map((f) => this.toFolderItem(f)),
      files: fileRows.map((f) => this.fileRepository.toFileItem(f)),
    };
    await this.cache.set(key, result);
    return result;
  }

  async create(userId: string, name: string, parentId?: string): Promise<FolderItem> {
    if (parentId) {
      const parent = await this.folderRepository.findByIdAndUser(parentId, userId);
      if (!parent) throw new ApiException('FOLDER_NOT_FOUND');
    }
    const row = await this.folderRepository.insert({ userId, name, parentId: parentId ?? null });
    await this.invalidate(userId, parentId ?? null);
    return this.toFolderItem(row);
  }

  async rename(id: string, userId: string, name: string): Promise<FolderItem> {
    const row = await this.folderRepository.rename(id, userId, name);
    if (!row) throw new ApiException('FOLDER_NOT_FOUND');
    await this.invalidate(userId, row.parentId ?? null);
    return this.toFolderItem(row);
  }

  async move(id: string, userId: string, parentId: string | null): Promise<FolderItem> {
    const folder = await this.folderRepository.findByIdAndUser(id, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');

    if (parentId !== null) {
      const target = await this.folderRepository.findByIdAndUser(parentId, userId);
      if (!target) throw new ApiException('FOLDER_NOT_FOUND');
      const isDescendant = await this.folderRepository.isDescendant(parentId, id);
      if (isDescendant) throw new ApiException('INVALID_MOVE_TARGET');
    }

    const row = await this.folderRepository.move(id, userId, parentId);
    if (!row) throw new ApiException('FOLDER_NOT_FOUND');

    await Promise.all([
      this.invalidate(userId, folder.parentId ?? null),
      this.invalidate(userId, parentId),
    ]);
    return this.toFolderItem(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const folder = await this.folderRepository.findByIdAndUser(id, userId);
    if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
    await this.folderRepository.softDeleteCascade(id, userId);
    await this.invalidate(userId, folder.parentId ?? null);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest folder.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/folder/folder.service.ts services/api/src/folder/folder.service.spec.ts
git commit -m "feat: FolderService 구현"
```

---

## Task 12: Folder Controller + Module

**Files:**
- Create: `services/api/src/folder/folder.controller.ts`
- Create: `services/api/src/folder/folder.controller.spec.ts`
- Create: `services/api/src/folder/folder.module.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: folder.controller.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { FolderService } from './folder.service';
import { FolderController } from './folder.controller';

const mockFolderService = {
  getRoot: jest.fn(),
  getChildren: jest.fn(),
  create: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  remove: jest.fn(),
};

describe('FolderController', () => {
  let controller: FolderController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FolderController],
      providers: [{ provide: FolderService, useValue: mockFolderService }],
    }).compile();
    controller = module.get(FolderController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest folder.controller.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: folder.controller.ts 작성**

```ts
import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FolderService } from './folder.service';

@Controller()
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @TsRestHandler(contract.folder.getRoot)
  handleGetRoot(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.getRoot, async () => {
      const result = await this.folderService.getRoot(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.getChildren)
  handleGetChildren(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.getChildren, async ({ params }) => {
      const result = await this.folderService.getChildren(params.id, user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.create)
  handleCreate(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.create, async ({ body }) => {
      const result = await this.folderService.create(user.userId, body.name, body.parentId);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.folder.rename)
  handleRename(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.rename, async ({ params, body }) => {
      const result = await this.folderService.rename(params.id, user.userId, body.name);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.move)
  handleMove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.move, async ({ params, body }) => {
      const result = await this.folderService.move(params.id, user.userId, body.parentId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.remove)
  handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.remove, async ({ params }) => {
      await this.folderService.remove(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}
```

- [ ] **Step 4: folder.module.ts 작성**

```ts
import { Module } from '@nestjs/common';
import { FileRepository } from '../file/file.repository';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

@Module({
  controllers: [FolderController],
  providers: [FolderService, FolderRepository, FileRepository],
  exports: [FolderRepository],
})
export class FolderModule {}
```

> **Note:** `FolderService`가 `FileRepository`에 의존하므로 여기서 함께 제공한다. `FileModule`이 생성된 이후 `FileModule`을 import하는 방식으로 변경해도 무방하다.

- [ ] **Step 5: app.module.ts에 FolderModule 등록**

`imports` 배열에 추가:

```ts
import { FolderModule } from './folder/folder.module';
// ...
FolderModule,
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
npx jest folder.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/folder/ services/api/src/app.module.ts
git commit -m "feat: FolderController·Module 구현"
```

---

## Task 13: File Repository

**Files:**
- Create: `services/api/src/file/file.repository.ts`
- Create: `services/api/src/file/file.repository.spec.ts`

- [ ] **Step 1: file.repository.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { FileRepository } from './file.repository';

describe('FileRepository', () => {
  let repo: FileRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();
    repo = module.get(FileRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  it('findByIdAndUser는 일치하는 파일이 없으면 null을 반환한다', async () => {
    const { mockDbLimit } = await import('@terab/test');
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findByIdAndUser('file-1', 'user-1');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest file.repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: file.repository.ts 작성**

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, files, Files$Insert, Files$Select } from '@terab/db';
import type { FileItem } from '@terab/contract';
import { and, eq, ilike, isNull } from 'drizzle-orm';

@Injectable()
export class FileRepository {
  constructor(private readonly database: DatabaseService) {}

  toFileItem(row: Files$Select): FileItem {
    return {
      id: row.id,
      name: row.name,
      folderId: row.folderId ?? null,
      size: row.size,
      mimeType: row.mimeType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByIdAndUser(id: string, userId: string): Promise<Files$Select | null> {
    const [row = null] = await this.database.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .limit(1);
    return row;
  }

  async findRootFiles(userId: string): Promise<Files$Select[]> {
    return this.database.db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), isNull(files.folderId), isNull(files.softDeletedAt)));
  }

  async findByFolder(folderId: string, userId: string): Promise<Files$Select[]> {
    return this.database.db
      .select()
      .from(files)
      .where(
        and(eq(files.userId, userId), eq(files.folderId, folderId), isNull(files.softDeletedAt)),
      );
  }

  async insert(data: Pick<Files$Insert, 'userId' | 'folderId' | 'name' | 'minioKey' | 'size' | 'mimeType'>): Promise<Files$Select> {
    const [row] = await this.database.db.insert(files).values(data).returning();
    return row;
  }

  async rename(id: string, userId: string, name: string): Promise<Files$Select | null> {
    const [row = null] = await this.database.db
      .update(files)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning();
    return row;
  }

  async move(id: string, userId: string, folderId: string | null): Promise<Files$Select | null> {
    const [row = null] = await this.database.db
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning();
    return row;
  }

  async softDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.database.db
      .update(files)
      .set({ softDeletedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId), isNull(files.softDeletedAt)))
      .returning({ id: files.id });
    return result.length > 0;
  }

  async search(userId: string, query: string, folderId?: string): Promise<Files$Select[]> {
    const conditions = [
      eq(files.userId, userId),
      isNull(files.softDeletedAt),
      ilike(files.name, `%${query}%`),
    ];
    if (folderId) conditions.push(eq(files.folderId, folderId));
    return this.database.db.select().from(files).where(and(...conditions));
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest file.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/file.repository.ts services/api/src/file/file.repository.spec.ts
git commit -m "feat: FileRepository 구현"
```

---

## Task 14: File Service

**Files:**
- Create: `services/api/src/file/file.service.ts`
- Create: `services/api/src/file/file.service.spec.ts`

- [ ] **Step 1: file.service.spec.ts 작성**

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { MinioService } from '../minio/minio.service';
import { FolderRepository } from '../folder/folder.repository';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';

const mockFileRepository = {
  findByIdAndUser: jest.fn(),
  findRootFiles: jest.fn(),
  findByFolder: jest.fn(),
  insert: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  softDelete: jest.fn(),
  search: jest.fn(),
  toFileItem: jest.fn((row) => ({ ...row, folderId: row.folderId ?? null })),
};

const mockFolderRepository = {
  findByIdAndUser: jest.fn(),
};

const mockMinioService = {
  bucketName: 'drive',
  putObject: jest.fn(),
  getObject: jest.fn(),
  statObject: jest.fn(),
  copyObject: jest.fn(),
  removeObject: jest.fn(),
};

const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

describe('FileService', () => {
  let service: FileService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: FileRepository, useValue: mockFileRepository },
        { provide: FolderRepository, useValue: mockFolderRepository },
        { provide: MinioService, useValue: mockMinioService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();
    service = module.get(FileService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('rename은 파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
    mockFileRepository.rename.mockResolvedValue(null);
    await expect(service.rename('f1', 'u1', 'new.txt')).rejects.toThrow(ApiException);
  });

  it('move는 대상 폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
    mockFileRepository.findByIdAndUser.mockResolvedValue({ id: 'f1', folderId: null });
    mockFolderRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(service.move('f1', 'u1', 'folder-1')).rejects.toThrow(ApiException);
  });

  it('remove는 파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
    mockFileRepository.softDelete.mockResolvedValue(false);
    await expect(service.remove('f1', 'u1')).rejects.toThrow(ApiException);
  });

  it('upload는 multer 파일 메타데이터를 DB에 저장하고 FileItem을 반환한다', async () => {
    const multerFile = {
      originalname: 'test.txt',
      filename: 'user-1/uuid-key',
      size: 1024,
      mimetype: 'text/plain',
    } as Express.Multer.File;
    const row = {
      id: 'f1', name: 'test.txt', folderId: null, userId: 'u1',
      minioKey: 'user-1/uuid-key', size: 1024, mimeType: 'text/plain',
      createdAt: new Date(), updatedAt: new Date(), softDeletedAt: null,
    };
    mockFileRepository.insert.mockResolvedValue(row);

    const result = await service.upload('u1', multerFile, undefined);

    expect(mockFileRepository.insert).toHaveBeenCalledWith({
      userId: 'u1', folderId: null,
      name: 'test.txt', minioKey: 'user-1/uuid-key',
      size: 1024, mimeType: 'text/plain',
    });
    expect(result.name).toBe('test.txt');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest file.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: file.service.ts 작성**

```ts
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import type { FileItem, FileSearchResponse } from '@terab/contract';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { FolderRepository } from '../folder/folder.repository';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';

@Injectable()
export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly folderRepository: FolderRepository,
    private readonly minioService: MinioService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private cacheKey(userId: string, folderId: string | null): string {
    return `files:user:${userId}:folder:${folderId ?? 'root'}`;
  }

  private async invalidate(userId: string, folderId: string | null): Promise<void> {
    await this.cache.del(this.cacheKey(userId, folderId));
  }

  async upload(userId: string, file: Express.Multer.File, folderId?: string): Promise<FileItem> {
    if (folderId) {
      const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
    }

    const row = await this.fileRepository.insert({
      userId,
      folderId: folderId ?? null,
      name: file.originalname,
      minioKey: file.filename,
      size: file.size,
      mimeType: file.mimetype,
    });

    await this.invalidate(userId, folderId ?? null);
    return this.fileRepository.toFileItem(row);
  }

  async getDownloadStream(userId: string, fileId: string): Promise<{ stream: Readable; name: string; size: number; mimeType: string }> {
    const file = await this.fileRepository.findByIdAndUser(fileId, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    const stream = await this.minioService.getObject(file.minioKey);
    return { stream, name: file.name, size: file.size, mimeType: file.mimeType };
  }

  async rename(id: string, userId: string, name: string): Promise<FileItem> {
    const row = await this.fileRepository.rename(id, userId, name);
    if (!row) throw new ApiException('FILE_NOT_FOUND');
    await this.invalidate(userId, row.folderId ?? null);
    return this.fileRepository.toFileItem(row);
  }

  async move(id: string, userId: string, folderId: string | null): Promise<FileItem> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');

    if (folderId !== null) {
      const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
    }

    const row = await this.fileRepository.move(id, userId, folderId);
    if (!row) throw new ApiException('FILE_NOT_FOUND');

    await Promise.all([
      this.invalidate(userId, file.folderId ?? null),
      this.invalidate(userId, folderId),
    ]);
    return this.fileRepository.toFileItem(row);
  }

  async copy(id: string, userId: string, folderId: string | null): Promise<FileItem> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');

    if (folderId !== null) {
      const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
    }

    const newKey = `${userId}/${randomUUID()}`;
    await this.minioService.copyObject(file.minioKey, newKey);
    const row = await this.fileRepository.insert({
      userId,
      folderId,
      name: file.name,
      minioKey: newKey,
      size: file.size,
      mimeType: file.mimeType,
    });
    await this.invalidate(userId, folderId);
    return this.fileRepository.toFileItem(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const file = await this.fileRepository.findByIdAndUser(id, userId);
    if (!file) throw new ApiException('FILE_NOT_FOUND');
    const deleted = await this.fileRepository.softDelete(id, userId);
    if (!deleted) throw new ApiException('FILE_NOT_FOUND');
    await this.invalidate(userId, file.folderId ?? null);
  }

  async search(userId: string, q: string, scope: 'all' | 'folder', folderId?: string): Promise<FileSearchResponse> {
    if (scope === 'folder' && !folderId) throw new ApiException('FOLDER_NOT_FOUND');
    const rows = await this.fileRepository.search(userId, q, scope === 'folder' ? folderId : undefined);
    return { files: rows.map((r) => this.fileRepository.toFileItem(r)) };
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest file.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/file.service.ts services/api/src/file/file.service.spec.ts
git commit -m "feat: FileService 구현"
```

---

## Task 15: File Controller + Download Controller + Module

**Files:**
- Create: `services/api/src/file/file.controller.ts`
- Create: `services/api/src/file/file-download.controller.ts`
- Create: `services/api/src/file/file.controller.spec.ts`
- Create: `services/api/src/file/file-download.controller.spec.ts`
- Create: `services/api/src/file/file.module.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: file.controller.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { FileService } from './file.service';
import { FileController } from './file.controller';

const mockFileService = {
  upload: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  copy: jest.fn(),
  remove: jest.fn(),
  search: jest.fn(),
};

describe('FileController', () => {
  let controller: FileController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileController],
      providers: [{ provide: FileService, useValue: mockFileService }],
    }).compile();
    controller = module.get(FileController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest file.controller.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: file.controller.ts 작성**

```ts
import { Controller, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FileService } from './file.service';

@Controller()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @TsRestHandler(contract.file.upload)
  @UseInterceptors(FileInterceptor('file'))
  handleUpload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return tsRestHandler(contract.file.upload, async ({ body }) => {
      const result = await this.fileService.upload(user.userId, file, body.folderId);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.file.rename)
  handleRename(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.rename, async ({ params, body }) => {
      const result = await this.fileService.rename(params.id, user.userId, body.name);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.file.move)
  handleMove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.move, async ({ params, body }) => {
      const result = await this.fileService.move(params.id, user.userId, body.folderId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.file.copy)
  handleCopy(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.copy, async ({ params, body }) => {
      const result = await this.fileService.copy(params.id, user.userId, body.folderId);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.file.remove)
  handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.remove, async ({ params }) => {
      await this.fileService.remove(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.file.search)
  handleSearch(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.search, async ({ query }) => {
      const result = await this.fileService.search(user.userId, query.q, query.scope, query.folderId);
      return { status: HttpStatus.OK, body: result };
    });
  }
}
```

- [ ] **Step 4: file-download.controller.ts 작성**

바이너리 스트림 응답은 ts-rest 대신 표준 NestJS 라우팅으로 처리한다.

```ts
import { Controller, Delete, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import type { Response } from 'express';
import archiver from 'archiver';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FileService } from './file.service';
import { FileRepository } from './file.repository';
import { ApiException } from '@terab/common';
import { Body } from '@nestjs/common';

const ZIP_LIMIT = 100;

@Controller()
export class FileDownloadController {
  constructor(
    private readonly fileService: FileService,
    private readonly fileRepository: FileRepository,
  ) {}

  @Get('/files/:id/download')
  async downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
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
  async downloadZip(
    @CurrentUser() user: AuthUser,
    @Body() body: { fileIds: string[] },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.fileIds || body.fileIds.length > ZIP_LIMIT) {
      throw new ApiException('ZIP_LIMIT_EXCEEDED');
    }

    const fileRows = await Promise.all(
      body.fileIds.map((id) => this.fileRepository.findByIdAndUser(id, user.userId)),
    );
    const validFiles = fileRows.filter((f): f is NonNullable<typeof f> => f !== null);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="download.zip"',
    });

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const file of validFiles) {
      const stream = await this.fileService.getDownloadStream(user.userId, file.id);
      archive.append(stream.stream, { name: file.name });
    }

    await archive.finalize();
  }
}
```

- [ ] **Step 5: file-download.controller.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { FileDownloadController } from './file-download.controller';
import { FileService } from './file.service';
import { FileRepository } from './file.repository';

const mockFileService = { getDownloadStream: jest.fn() };
const mockFileRepository = { findByIdAndUser: jest.fn() };

describe('FileDownloadController', () => {
  let controller: FileDownloadController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileDownloadController],
      providers: [
        { provide: FileService, useValue: mockFileService },
        { provide: FileRepository, useValue: mockFileRepository },
      ],
    }).compile();
    controller = module.get(FileDownloadController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
```

- [ ] **Step 6: file.module.ts 작성**

```ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';
import { MinioStorageEngine } from '../minio/minio-storage.engine';
import { FolderRepository } from '../folder/folder.repository';
import { FileDownloadController } from './file-download.controller';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [MinioService],
      useFactory: (minioService: MinioService) => ({
        storage: new MinioStorageEngine(minioService),
      }),
    }),
  ],
  controllers: [FileController, FileDownloadController],
  providers: [FileService, FileRepository, FolderRepository],
  exports: [FileRepository, FileService],
})
export class FileModule {}
```

> **Note:** `MinioModule`이 `@Global()`이므로 `MinioService`는 별도 `imports` 없이 `inject`에서 직접 참조 가능하다.

- [ ] **Step 7: app.module.ts 업데이트**

`FolderModule` 이후에 `FileModule` 추가:

```ts
import { FileModule } from './file/file.module';
// imports 배열에:
FileModule,
```

또한 `FolderModule`에서 `FileRepository` 중복 제공 문제를 해결하기 위해 `folder.module.ts`를 수정:

```ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

@Module({
  imports: [FileModule],
  controllers: [FolderController],
  providers: [FolderService, FolderRepository],
  exports: [FolderRepository],
})
export class FolderModule {}
```

- [ ] **Step 8: 테스트 실행 — 통과 확인**

```bash
npx jest file.controller.spec.ts file-download.controller.spec.ts
```

Expected: 모두 PASS.

- [ ] **Step 9: 전체 빌드 확인**

```bash
npm run build
```

Expected: 에러 없음.

- [ ] **Step 10: Commit**

```bash
git add services/api/src/file/ services/api/src/folder/folder.module.ts services/api/src/app.module.ts
git commit -m "feat: FileController·FileDownloadController·FileModule 구현"
```

---

## Task 16: Trash Repository

**Files:**
- Create: `services/api/src/trash/trash.repository.ts`
- Create: `services/api/src/trash/trash.repository.spec.ts`

- [ ] **Step 1: trash.repository.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { TrashRepository } from './trash.repository';

describe('TrashRepository', () => {
  let repo: TrashRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TrashRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();
    repo = module.get(TrashRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  it('findAllDeleted는 소프트 삭제된 파일과 폴더를 합쳐 반환한다', async () => {
    const { mockDbLimit } = await import('@terab/test');
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findAllDeleted('user-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest trash.repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: trash.repository.ts 작성**

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, files, Files$Select, folders, Folders$Select } from '@terab/db';
import type { TrashItem } from '@terab/contract';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

@Injectable()
export class TrashRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAllDeleted(userId: string): Promise<TrashItem[]> {
    const [deletedFiles, deletedFolders] = await Promise.all([
      this.database.db
        .select()
        .from(files)
        .where(and(eq(files.userId, userId), isNotNull(files.softDeletedAt))),
      this.database.db
        .select()
        .from(folders)
        .where(and(eq(folders.userId, userId), isNotNull(folders.softDeletedAt))),
    ]);

    const fileItems: TrashItem[] = deletedFiles.map((f) => ({
      id: f.id,
      type: 'file' as const,
      name: f.name,
      deletedAt: f.softDeletedAt!,
    }));

    const folderItems: TrashItem[] = deletedFolders.map((f) => ({
      id: f.id,
      type: 'folder' as const,
      name: f.name,
      deletedAt: f.softDeletedAt!,
    }));

    return [...fileItems, ...folderItems].sort(
      (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime(),
    );
  }

  async findDeletedFile(id: string, userId: string): Promise<Files$Select | null> {
    const [row = null] = await this.database.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId), isNotNull(files.softDeletedAt)))
      .limit(1);
    return row;
  }

  async findDeletedFolder(id: string, userId: string): Promise<Folders$Select | null> {
    const [row = null] = await this.database.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNotNull(folders.softDeletedAt)))
      .limit(1);
    return row;
  }

  async restoreFile(id: string, userId: string): Promise<boolean> {
    const result = await this.database.db
      .update(files)
      .set({ softDeletedAt: null })
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning({ id: files.id });
    return result.length > 0;
  }

  async restoreFolder(id: string, userId: string): Promise<void> {
    await this.database.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      UPDATE folders SET soft_deleted_at = NULL
      WHERE id IN (SELECT id FROM subtree)
    `);
    await this.database.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      UPDATE files SET soft_deleted_at = NULL
      WHERE folder_id IN (SELECT id FROM subtree)
    `);
  }

  async permanentDeleteFile(id: string, userId: string): Promise<string | null> {
    const [row = null] = await this.database.db
      .delete(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning({ minioKey: files.minioKey });
    return row?.minioKey ?? null;
  }

  async permanentDeleteFolderTree(id: string, userId: string): Promise<string[]> {
    const fileKeys = await this.database.db.execute<{ minio_key: string }>(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      DELETE FROM files
      WHERE folder_id IN (SELECT id FROM subtree) AND user_id = ${userId}
      RETURNING minio_key
    `);

    await this.database.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM folders WHERE id = ${id} AND user_id = ${userId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      DELETE FROM folders WHERE id IN (SELECT id FROM subtree)
    `);

    return (fileKeys as Array<{ minio_key: string }>).map((r) => r.minio_key);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest trash.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/trash/trash.repository.ts services/api/src/trash/trash.repository.spec.ts
git commit -m "feat: TrashRepository 구현"
```

---

## Task 17: Trash Service + Controller + Module

**Files:**
- Create: `services/api/src/trash/trash.service.ts`
- Create: `services/api/src/trash/trash.service.spec.ts`
- Create: `services/api/src/trash/trash.controller.ts`
- Create: `services/api/src/trash/trash.controller.spec.ts`
- Create: `services/api/src/trash/trash.module.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: trash.service.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { MinioService } from '../minio/minio.service';
import { TrashRepository } from './trash.repository';
import { TrashService } from './trash.service';

const mockTrashRepository = {
  findAllDeleted: jest.fn(),
  findDeletedFile: jest.fn(),
  findDeletedFolder: jest.fn(),
  restoreFile: jest.fn(),
  restoreFolder: jest.fn(),
  permanentDeleteFile: jest.fn(),
  permanentDeleteFolderTree: jest.fn(),
};

const mockMinioService = { removeObject: jest.fn(), removeObjects: jest.fn() };

describe('TrashService', () => {
  let service: TrashService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TrashService,
        { provide: TrashRepository, useValue: mockTrashRepository },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();
    service = module.get(TrashService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('restore file은 파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
    mockTrashRepository.findDeletedFile.mockResolvedValue(null);
    await expect(service.restore('id', 'file', 'u1')).rejects.toThrow(ApiException);
  });

  it('permanentDelete file은 minioKey를 조회 후 MinIO와 DB를 삭제한다', async () => {
    mockTrashRepository.permanentDeleteFile.mockResolvedValue('user-1/key-1');
    await service.permanentDelete('id', 'file', 'u1');
    expect(mockMinioService.removeObject).toHaveBeenCalledWith('user-1/key-1');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest trash.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: trash.service.ts 작성**

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import type { TrashListResponse } from '@terab/contract';
import { MinioService } from '../minio/minio.service';
import { TrashRepository } from './trash.repository';

@Injectable()
export class TrashService {
  constructor(
    private readonly trashRepository: TrashRepository,
    private readonly minioService: MinioService,
  ) {}

  async list(userId: string): Promise<TrashListResponse> {
    const items = await this.trashRepository.findAllDeleted(userId);
    return { items };
  }

  async restore(id: string, type: 'file' | 'folder', userId: string): Promise<void> {
    if (type === 'file') {
      const file = await this.trashRepository.findDeletedFile(id, userId);
      if (!file) throw new ApiException('FILE_NOT_FOUND');
      await this.trashRepository.restoreFile(id, userId);
    } else {
      const folder = await this.trashRepository.findDeletedFolder(id, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
      await this.trashRepository.restoreFolder(id, userId);
    }
  }

  async permanentDelete(id: string, type: 'file' | 'folder', userId: string): Promise<void> {
    if (type === 'file') {
      const minioKey = await this.trashRepository.permanentDeleteFile(id, userId);
      if (!minioKey) throw new ApiException('FILE_NOT_FOUND');
      await this.minioService.removeObject(minioKey);
    } else {
      const folder = await this.trashRepository.findDeletedFolder(id, userId);
      if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
      const minioKeys = await this.trashRepository.permanentDeleteFolderTree(id, userId);
      if (minioKeys.length > 0) {
        await this.minioService.removeObjects(minioKeys);
      }
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest trash.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: trash.controller.spec.ts 작성**

```ts
import { Test } from '@nestjs/testing';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

const mockTrashService = { list: jest.fn(), restore: jest.fn(), permanentDelete: jest.fn() };

describe('TrashController', () => {
  let controller: TrashController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrashController],
      providers: [{ provide: TrashService, useValue: mockTrashService }],
    }).compile();
    controller = module.get(TrashController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
```

- [ ] **Step 6: trash.controller.ts 작성**

```ts
import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrashService } from './trash.service';

@Controller()
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @TsRestHandler(contract.trash.list)
  handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.list, async () => {
      const result = await this.trashService.list(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.trash.restore)
  handleRestore(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.restore, async ({ params, body }) => {
      await this.trashService.restore(params.id, body.type, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.trash.permanentDelete)
  handlePermanentDelete(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.permanentDelete, async ({ params, body }) => {
      await this.trashService.permanentDelete(params.id, body.type, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}
```

- [ ] **Step 7: trash.module.ts 작성**

```ts
import { Module } from '@nestjs/common';
import { TrashController } from './trash.controller';
import { TrashRepository } from './trash.repository';
import { TrashService } from './trash.service';

@Module({
  controllers: [TrashController],
  providers: [TrashService, TrashRepository],
})
export class TrashModule {}
```

- [ ] **Step 8: app.module.ts에 TrashModule 등록**

```ts
import { TrashModule } from './trash/trash.module';
// imports 배열에:
TrashModule,
```

- [ ] **Step 9: 테스트 실행 — 통과 확인**

```bash
npx jest trash.service.spec.ts trash.controller.spec.ts
```

Expected: 모두 PASS.

- [ ] **Step 10: 전체 빌드 + 전체 테스트 실행**

```bash
npm run build
npm test
```

Expected: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 11: Commit**

```bash
git add services/api/src/trash/ services/api/src/app.module.ts
git commit -m "feat: TrashService·TrashController·TrashModule 구현"
```

---

## 스펙 커버리지 검토

| 스펙 섹션 | 구현 Task |
|---|---|
| 1.1 folders 테이블 | Task 2 |
| 1.2 files 테이블 | Task 3 |
| 1.3 MinIO 키 전략 (`{userId}/{uuid}`) | Task 14 (FileService.upload) |
| 2.1 폴더 6개 엔드포인트 | Task 8, 12 |
| 2.2 파일 8개 엔드포인트 (다운로드 제외) | Task 9, 15 |
| 2.2 다운로드 (단일/ZIP) | Task 15 (FileDownloadController) |
| 2.3 휴지통 3개 엔드포인트 | Task 9, 16~17 |
| 3.1 업로드 흐름 (multer MinioStorageEngine → MinIO pipe) | Task 5, 14, 15 |
| 3.2 폴더 소프트 삭제 cascade (CTE) | Task 10 (FolderRepository) |
| 3.3 파일 이동 | Task 14 |
| 3.4 파일 복사 (MinIO copyObject) | Task 14 |
| 3.5 영구 삭제 | Task 17 |
| 3.6 ZIP 다운로드 (archiver) | Task 15 |
| 4. Redis 캐시 (cacheKey, invalidate) | Task 6, 11, 14 |
| 5. ErrorCode 7개 | Task 4 |
| 6. 모듈 구조 | Task 12, 15, 17 |
| 7. contracts (folder/file/trash) | Task 7~9 |

---

## 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-05-06 | 초기 계획 작성 |
| 2026-05-06 | busboy → multer `MinioStorageEngine` 으로 업로드 레이어 변경 (서비스에서 Request 의존 제거) |

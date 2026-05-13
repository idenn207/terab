# Presigned URL 기반 파일 업로드 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `FileInterceptor` 스트림 위임 방식을 presigned URL 기반 2-Phase 업로드(Init → Direct PUT → Complete)로 교체해 DB·MinIO sync 무결성을 보장한다.

**Architecture:** API 서버는 파일 바이트 흐름에서 빠지고 presigned URL 발급·검증·DB 반영만 담당한다. `upload_sessions` 테이블이 pending 상태를 추적하고, BullMQ 워커 + MinIO bucket lifecycle 이중 안전망이 orphan을 회수한다. 100MB 임계로 단일 PUT/Multipart 자동 분기, 100GB 상한.

**Tech Stack:** NestJS 11 / ts-rest + Zod / Drizzle / PostgreSQL 16 / MinIO (minio-js) / BullMQ / React 19 + Vite

**Spec:** [docs/superpowers/specs/2026-05-13-presigned-upload-design.md](../specs/2026-05-13-presigned-upload-design.md)

---

## File Structure

### 신규 (Create)

| Path                                                          | Responsibility                                      |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `services/api/src/database/schema/upload-sessions.schema.ts`  | `upload_sessions` 테이블 + 타입                     |
| `services/api/src/file/upload-session.repository.ts`          | session CRUD + 만료 조회 (FOR UPDATE / SKIP LOCKED) |
| `services/api/src/file/upload-session.repository.spec.ts`     | repository 단위 테스트                              |
| `services/api/src/file/upload-session.service.ts`             | init/complete/cleanup 도메인 로직                   |
| `services/api/src/file/upload-session.service.spec.ts`        | service 단위 테스트                                 |
| `services/api/src/file/upload-session.cleanup.worker.ts`      | BullMQ `@Processor` + repeatable job 부트스트랩     |
| `services/api/src/file/upload-session.cleanup.worker.spec.ts` | worker 단위 테스트                                  |
| `services/api/src/file/file-upload.controller.ts`             | uploadInit / uploadComplete 핸들러                  |
| `services/api/src/file/file-upload.controller.spec.ts`        | controller 통합 테스트                              |
| `services/api/src/test/fixtures/upload-session.fixtures.ts`   | session fixture                                     |
| `services/web/src/features/file-upload/upload-file.ts`        | 클라이언트 헬퍼 (init → PUT → complete)             |
| `services/web/src/features/file-upload/upload-parts.ts`       | part 분할·병렬 PUT·재시도                           |
| `services/nginx/storage.conf`                                 | `storage.skypark207.com` 가상호스트                 |
| `scripts/setup-minio.sh`                                      | bucket lifecycle + CORS 멱등성 셋업                 |

### 수정 (Modify)

| Path                                                    | Change                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/contracts/src/schemas/file.schema.ts`         | UploadInit/Complete 스키마 + MAX_FILE_SIZE 상수                    |
| `packages/contracts/src/contracts/file.contract.ts`     | `upload` 제거, `uploadInit`/`uploadComplete` 추가                  |
| `services/api/src/database/schema/index.ts`             | upload-sessions re-export                                          |
| `services/api/src/common/exceptions/error-code.enum.ts` | 5개 신규 ErrorCode                                                 |
| `services/api/src/minio/minio.service.ts`               | `presignClient` + presigned/multipart 메서드, statObject 확장      |
| `services/api/src/folder/folder.service.ts`             | `assertBelongsToUser` 추가                                         |
| `services/api/src/file/file.controller.ts`              | `handleUpload` 제거                                                |
| `services/api/src/file/file.service.ts`                 | `upload()` 제거                                                    |
| `services/api/src/file/file.module.ts`                  | MulterModule 제거, BullModule + 신규 provider, FolderModule import |
| `services/api/src/file/file.controller.spec.ts`         | `handleUpload` 테스트 제거                                         |
| `services/api/src/file/file.service.spec.ts`            | `upload()` 테스트 제거                                             |
| `api.env.example`, `infra.env.example`                  | `MINIO_PUBLIC_ENDPOINT`, `WEB_ORIGIN` 추가                         |
| `services/nginx/` 기존 host 설정                        | `client_max_body_size` 축소                                        |
| `Makefile`                                              | `setup-minio` 타겟 추가                                            |

### 삭제 (Delete)

| Path                                                  | Reason                                  |
| ----------------------------------------------------- | --------------------------------------- |
| `services/api/src/minio/minio-storage.engine.ts`      | FileInterceptor 흐름 제거에 따라 불필요 |
| `services/api/src/minio/minio-storage.engine.spec.ts` | (있다면) 함께 삭제                      |

---

## Phase 1 — Contract & Schema Foundation

### Task 1: 신규 ErrorCode 등록

**Files:**

- Modify: `services/api/src/common/exceptions/error-code.enum.ts`

- [ ] **Step 1: ErrorCode에 5개 키 추가**

`Folder/File` 섹션 뒤에 다음을 추가:

```ts
// ───── Upload Session ──────────────────────────────
FILE_TOO_LARGE: {
  message: '파일 크기가 한도(100GB)를 초과했습니다.',
  status: HttpStatus.PAYLOAD_TOO_LARGE,
},
UPLOAD_SESSION_NOT_FOUND: {
  message: '업로드 세션을 찾을 수 없습니다.',
  status: HttpStatus.NOT_FOUND,
},
UPLOAD_SESSION_EXPIRED: {
  message: '업로드 세션이 만료됐습니다.',
  status: HttpStatus.GONE,
},
UPLOAD_OBJECT_MISSING: {
  message: '업로드된 파일을 찾을 수 없습니다.',
  status: HttpStatus.BAD_REQUEST,
},
UPLOAD_SIZE_MISMATCH: {
  message: '업로드된 파일 크기가 선언값과 다릅니다.',
  status: HttpStatus.BAD_REQUEST,
},
```

- [ ] **Step 2: 타입 체크**

Run: `cd services/api && npm run build`
Expected: 빌드 성공, 새 ErrorCodeKey 타입에 5개 키 포함

- [ ] **Step 3: Commit**

```bash
git add services/api/src/common/exceptions/error-code.enum.ts
git commit -m "feat(api): 업로드 세션 관련 ErrorCode 추가"
```

---

### Task 2: Contract 스키마 정의

**Files:**

- Modify: `packages/contracts/src/schemas/file.schema.ts`

- [ ] **Step 1: 기존 파일 상단 import 확인 (z만 import되어 있어야 함, 변경 없음)**

- [ ] **Step 2: 파일 하단에 다음 스키마 추가**

```ts
const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100 GiB

export const UploadInitBodySchema = z.object({
  folderId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().min(1).max(127),
});

export const UploadPartSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  uploadUrl: z.string().url(),
});

export const UploadInitResponseSchema = z.object({
  sessionId: z.string().uuid(),
  parts: z.array(UploadPartSchema).min(1),
  uploadHeaders: z.record(z.string()),
  expiresAt: z.coerce.date(),
});

export const UploadCompletePartSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().min(1).max(128),
});

export const UploadCompleteBodySchema = z.object({
  parts: z.array(UploadCompletePartSchema).min(1),
});

export type UploadInitBody = z.infer<typeof UploadInitBodySchema>;
export type UploadPart = z.infer<typeof UploadPartSchema>;
export type UploadInitResponse = z.infer<typeof UploadInitResponseSchema>;
export type UploadCompletePart = z.infer<typeof UploadCompletePartSchema>;
export type UploadCompleteBody = z.infer<typeof UploadCompleteBodySchema>;
```

- [ ] **Step 3: 빌드 확인**

Run: `cd packages/contracts && npm run build`
Expected: `dist/` 생성, 타입 에러 없음

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/schemas/file.schema.ts
git commit -m "feat(contracts): 업로드 Init/Complete Zod 스키마 추가"
```

---

### Task 3: Contract endpoint 교체

**Files:**

- Modify: `packages/contracts/src/contracts/file.contract.ts`

- [ ] **Step 1: import 수정**

`@terab/schema` import 라인에 다음 추가:

```ts
import {
  EmptySchema,
  FileItemSchema,
  FileSearchQuerySchema,
  FileSearchResponseSchema,
  MoveFileBodySchema,
  RenameFileBodySchema,
  UploadCompleteBodySchema,
  UploadInitBodySchema,
  UploadInitResponseSchema,
} from '@terab/schema';
```

- [ ] **Step 2: 기존 `upload` 정의 삭제**

`const upload = c.mutation({ ... });` 블록 전체 제거.

- [ ] **Step 3: 신규 endpoint 2개 추가 (rename 위에 배치)**

```ts
const uploadInit = c.mutation({
  summary: '파일 업로드 세션 생성 (presigned URL 발급)',
  method: 'POST',
  path: '/files/upload-init',
  contentType: 'application/json',
  body: UploadInitBodySchema,
  responses: {
    [HttpStatus.CREATED]: UploadInitResponseSchema,
  },
  strictStatusCodes: true,
});

const uploadComplete = c.mutation({
  summary: '파일 업로드 완료 (DB 반영)',
  method: 'POST',
  path: '/files/:sessionId/upload-complete',
  pathParams: z.object({ sessionId: z.string().uuid() }),
  contentType: 'application/json',
  body: UploadCompleteBodySchema,
  responses: {
    [HttpStatus.CREATED]: FileItemSchema,
  },
  strictStatusCodes: true,
});
```

- [ ] **Step 4: router export 수정**

```ts
export const fileContract = c.router({ uploadInit, uploadComplete, rename, move, copy, remove, search });
```

- [ ] **Step 5: 빌드 확인**

Run: `cd packages/contracts && npm run build`
Expected: 빌드 성공

- [ ] **Step 6: API 빌드도 깨지는지 확인 (의도된 깨짐)**

Run: `cd services/api && npm run build`
Expected: **FAIL** — `contract.file.upload` 참조가 `FileController`에 남아 있음. 이것은 Phase 4에서 해결됨. 이 상태로 commit한다.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/contracts/file.contract.ts
git commit -m "feat(contracts): upload contract을 uploadInit/uploadComplete로 교체"
```

---

### Task 4: `upload_sessions` 스키마

**Files:**

- Create: `services/api/src/database/schema/upload-sessions.schema.ts`
- Modify: `services/api/src/database/schema/index.ts`

- [ ] **Step 1: 신규 스키마 파일 생성**

```ts
import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { folders } from './folders.schema';
import { users } from './users.schema';

export const uploadSessions = table(
  'upload_sessions',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: t.uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),

    name: t.varchar('name', { length: 255 }).notNull(),
    size: t.bigint('size', { mode: 'number' }).notNull(),
    mimeType: t.varchar('mime_type', { length: 127 }).notNull(),
    minioKey: t.varchar('minio_key', { length: 512 }).notNull().unique(),

    uploadKind: t.varchar('upload_kind', { length: 16 }).notNull(),
    multipartUploadId: t.varchar('multipart_upload_id', { length: 128 }),

    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.expiresAt)],
);

export type UploadSessions$Insert = typeof uploadSessions.$inferInsert;
export type UploadSessions$Select = typeof uploadSessions.$inferSelect;
```

- [ ] **Step 2: index.ts에 re-export 추가**

`services/api/src/database/schema/index.ts`의 export 목록에 알파벳 순서로 삽입:

```ts
export * from './trusted-devices.schema';
export * from './two-fa-challenges.schema';
export * from './upload-sessions.schema';
export * from './user-roles.schema';
export * from './users.schema';
```

- [ ] **Step 3: Drizzle migration 생성**

Run: `cd services/api && npm run db:generate`
Expected: `drizzle/` 안에 새 SQL 파일이 생성됨 (`CREATE TABLE upload_sessions ...`)

- [ ] **Step 4: 생성된 SQL 파일 내용 검토**

생성된 `.sql` 파일을 열어 다음 항목 확인:

- `CREATE TABLE "upload_sessions"` 존재
- `user_id`, `folder_id` 외래키 cascade
- `minio_key` unique
- `user_id`, `expires_at` 인덱스
- snake_case 컬럼명

- [ ] **Step 5: Commit**

```bash
git add services/api/src/database/schema/upload-sessions.schema.ts \
        services/api/src/database/schema/index.ts \
        services/api/drizzle/
git commit -m "feat(api): upload_sessions 스키마 + 마이그레이션 추가"
```

---

## Phase 2 — MinIO Infrastructure

### Task 5: 환경변수 추가

**Files:**

- Modify: `api.env.example`
- Modify: `infra.env.example`

- [ ] **Step 1: api.env.example 끝에 추가**

`MINIO_DEFAULT_BUCKETS` 라인 아래에 추가:

```
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
WEB_ORIGIN=http://localhost:5173
```

(로컬 기본값; 운영 환경에서는 각각 `https://storage.skypark207.com`, `https://drive.skypark207.com` 등으로 덮어씀)

- [ ] **Step 2: infra.env.example 확인**

`infra.env.example`을 열어 MinIO 관련 설정이 있는지 확인. 운영용 endpoint가 필요하면 `MINIO_PUBLIC_ENDPOINT` 항목 추가.

- [ ] **Step 3: local.env (개발자 본인 환경)도 동기화**

> **주의**: `local.env`는 commit 대상이 아니다. 개발자 본인 환경에서만 수동으로 추가:
>
> ```
> MINIO_PUBLIC_ENDPOINT=http://localhost:9000
> WEB_ORIGIN=http://localhost:5173
> ```

- [ ] **Step 4: Commit**

```bash
git add api.env.example infra.env.example
git commit -m "chore: presigned URL용 환경변수 추가 (MINIO_PUBLIC_ENDPOINT, WEB_ORIGIN)"
```

---

### Task 6: MinioService - dual client + statObject 확장

**Files:**

- Modify: `services/api/src/minio/minio.service.ts`

- [ ] **Step 1: `presignClient` 인스턴스 추가**

`MinioService` constructor에서 두 번째 클라이언트를 만들어 보관:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Readable } from 'node:stream';

@Injectable()
export class MinioService {
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  readonly bucketName: string;

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(MinioService.name) private readonly logger: PinoLogger,
  ) {
    this.endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
    this.publicEndpoint = this.config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT');

    const [host, portStr] = this.endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;
    this.client = new Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: this.config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    const publicUrl = new URL(this.publicEndpoint);
    this.presignClient = new Client({
      endPoint: publicUrl.hostname,
      port: publicUrl.port ? parseInt(publicUrl.port, 10) : (publicUrl.protocol === 'https:' ? 443 : 80),
      useSSL: publicUrl.protocol === 'https:',
      accessKey: this.config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    this.bucketName = this.config.getOrThrow<string>('MINIO_DEFAULT_BUCKETS');
    this.logger.debug({ endpoint: this.endpoint, publicEndpoint: this.publicEndpoint, bucket: this.bucketName }, 'MinioService 초기화');
  }

  // ... 기존 putObject/getObject/copyObject/removeObject/removeObjects 유지
```

- [ ] **Step 2: statObject 반환 타입 확장 (mimeType 포함)**

기존 메서드 교체:

```ts
async statObject(key: string): Promise<{ size: number; mimeType: string }> {
  const stat = await this.client.statObject(this.bucketName, key);
  const mimeType = stat.metaData?.['content-type'] ?? 'application/octet-stream';
  return { size: stat.size, mimeType };
}
```

- [ ] **Step 3: 기존 spec(`minio.service.spec.ts`)에 `MINIO_PUBLIC_ENDPOINT` mock 추가**

```ts
const map: Record<string, string> = {
  MINIO_ENDPOINT: 'localhost:9000',
  MINIO_PUBLIC_ENDPOINT: 'http://localhost:9000',
  MINIO_ROOT_USER: 'minioadmin',
  MINIO_ROOT_PASSWORD: 'minioadmin',
  MINIO_DEFAULT_BUCKETS: 'drive',
};
```

- [ ] **Step 4: 테스트 실행**

Run: `cd services/api && npm test -- minio.service`
Expected: 기존 "should be defined" 테스트가 여전히 통과

- [ ] **Step 5: Commit**

```bash
git add services/api/src/minio/minio.service.ts services/api/src/minio/minio.service.spec.ts
git commit -m "feat(api): MinioService에 presignClient 분리 및 statObject mimeType 노출"
```

---

### Task 7: MinioService - presigned/multipart 메서드 추가

**Files:**

- Modify: `services/api/src/minio/minio.service.ts`
- Modify: `services/api/src/minio/minio.service.spec.ts`

- [ ] **Step 1: 단위 테스트 작성 (실패시키기 위해)**

`minio.service.spec.ts`에 다음 추가:

```ts
describe('presigned 메서드', () => {
  it('presignedPutObject는 presignClient 호출 결과 URL을 반환한다', async () => {
    // presignClient는 private — spy로 접근
    // minio-js 8.x: presignedPutObject(bucket, key, expires) — Content-Type 인자 없음
    // MIME sanitization은 UploadSessionService.init()에서 담당, uploadHeaders로 클라이언트에 반환
    const spy = jest.spyOn((service as any).presignClient, 'presignedPutObject').mockResolvedValue('https://presigned.example/put');
    const url = await service.presignedPutObject('u1/abc', 3600);
    expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 3600);
    expect(url).toBe('https://presigned.example/put');
  });

  it('createMultipartUpload는 minio-js Core API를 호출해 uploadId를 반환한다', async () => {
    const spy = jest.spyOn((service as any).client, 'initiateNewMultipartUpload').mockResolvedValue('upload-id-xyz');
    const result = await service.createMultipartUpload('u1/abc', 'video/mp4');
    expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', { 'Content-Type': 'video/mp4' });
    expect(result).toEqual({ uploadId: 'upload-id-xyz' });
  });

  it('presignedPutPart는 part PUT용 URL을 반환한다', async () => {
    const spy = jest.spyOn((service as any).presignClient, 'presignedUrl').mockResolvedValue('https://presigned.example/part?uploadId=u&partNumber=1');
    const url = await service.presignedPutPart('u1/abc', 'upload-id-xyz', 1, 3600);
    expect(spy).toHaveBeenCalledWith('PUT', 'drive', 'u1/abc', 3600, { uploadId: 'upload-id-xyz', partNumber: '1' });
    expect(url).toMatch(/^https:\/\/presigned\.example/);
  });

  it('completeMultipartUpload는 minio-js completeMultipartUpload를 호출한다', async () => {
    const spy = jest.spyOn((service as any).client, 'completeMultipartUpload').mockResolvedValue(undefined);
    await service.completeMultipartUpload('u1/abc', 'upload-id-xyz', [
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
    ]);
    expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 'upload-id-xyz', [
      { part: 1, etag: 'etag-1' },
      { part: 2, etag: 'etag-2' },
    ]);
  });

  it('abortMultipartUpload는 객체를 abort한다', async () => {
    const spy = jest.spyOn((service as any).client, 'abortMultipartUpload').mockResolvedValue(undefined);
    await service.abortMultipartUpload('u1/abc', 'upload-id-xyz');
    expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 'upload-id-xyz');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd services/api && npm test -- minio.service`
Expected: FAIL — `presignedPutObject is not a function` 등

- [ ] **Step 3: MinioService에 메서드 5개 구현**

`minio.service.ts`에 다음 추가:

```ts
async presignedPutObject(key: string, expirySec: number): Promise<string> {
  return this.presignClient.presignedPutObject(this.bucketName, key, expirySec);
}

async createMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
  // minio-js Core API — 공식 클라이언트에는 노출되지 않지만 prototype에 존재
  const uploadId = await (this.client as any).initiateNewMultipartUpload(this.bucketName, key, {
    'Content-Type': mimeType,
  });
  return { uploadId };
}

async presignedPutPart(key: string, uploadId: string, partNumber: number, expirySec: number): Promise<string> {
  return (this.presignClient as any).presignedUrl('PUT', this.bucketName, key, expirySec, {
    uploadId,
    partNumber: String(partNumber),
  });
}

async completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const list = parts.map((p) => ({ part: p.partNumber, etag: p.etag }));
  await (this.client as any).completeMultipartUpload(this.bucketName, key, uploadId, list);
}

async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  await (this.client as any).abortMultipartUpload(this.bucketName, key, uploadId);
}
```

> **참고**: `minio-js` 8.x 기준 multipart Core API(`initiateNewMultipartUpload`, `completeMultipartUpload`, `abortMultipartUpload`)는 prototype에는 존재하지만 TypeScript 타입에는 노출되지 않는 경우가 있어 `as any` 캐스트가 필요할 수 있다. 빌드 후 런타임에서 동작을 직접 확인하라.

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- minio.service`
Expected: 신규 5개 describe 케이스 모두 통과

- [ ] **Step 5: Commit**

```bash
git add services/api/src/minio/minio.service.ts services/api/src/minio/minio.service.spec.ts
git commit -m "feat(api): MinioService에 presigned/multipart 메서드 추가"
```

---

## Phase 3 — Upload Session Domain

### Task 8: UploadSession fixture 추가

**Files:**

- Create: `services/api/src/test/fixtures/upload-session.fixtures.ts`
- Modify: `services/api/src/test/fixtures/index.ts`

- [ ] **Step 1: fixture 파일 생성**

```ts
import type { UploadSessions$Select } from '@terab/db';

export const UPLOAD_SESSION_ID = '00000000-0000-0000-0000-000000000010';
export const UPLOAD_MINIO_KEY = 'uuid-1/00000000-0000-0000-0000-00000000aaaa';

export const mockUploadSessionSingle: UploadSessions$Select = {
  id: UPLOAD_SESSION_ID,
  userId: 'uuid-1',
  folderId: null,
  name: 'test.png',
  size: 1024,
  mimeType: 'image/png',
  minioKey: UPLOAD_MINIO_KEY,
  uploadKind: 'single',
  multipartUploadId: null,
  expiresAt: new Date('2999-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-05-13T00:00:00.000Z'),
};

export const mockUploadSessionMultipart: UploadSessions$Select = {
  ...mockUploadSessionSingle,
  id: '00000000-0000-0000-0000-000000000011',
  uploadKind: 'multipart',
  multipartUploadId: 'multipart-upload-id-1',
  size: 150 * 1024 * 1024,
};

export const mockUploadSessionExpired: UploadSessions$Select = {
  ...mockUploadSessionSingle,
  id: '00000000-0000-0000-0000-000000000012',
  expiresAt: new Date('2020-01-01T00:00:00.000Z'),
};
```

- [ ] **Step 2: index.ts에 re-export**

`services/api/src/test/fixtures/index.ts`를 열어 다음을 추가:

```ts
export * from './upload-session.fixtures';
```

(파일이 없으면 알파벳 순서로 생성)

- [ ] **Step 3: Commit**

```bash
git add services/api/src/test/fixtures/upload-session.fixtures.ts services/api/src/test/fixtures/index.ts
git commit -m "test(api): upload-session fixture 추가"
```

---

### Task 9: UploadSessionRepository

**Files:**

- Create: `services/api/src/file/upload-session.repository.ts`
- Create: `services/api/src/file/upload-session.repository.spec.ts`

- [ ] **Step 1: spec 파일 작성 (실패하는 테스트)**

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain, mockDbLimit } from '@terab/test';
import { UploadSessionRepository } from './upload-session.repository';

describe('UploadSessionRepository', () => {
  let repo: UploadSessionRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(UploadSessionRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  it('findById는 일치하는 session이 없으면 null을 반환한다', async () => {
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findById('ghost-id');
    expect(result).toBeNull();
  });

  it('findByIdForUpdate는 FOR UPDATE 절이 적용된 쿼리를 사용한다', async () => {
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findByIdForUpdate('ghost-id');
    expect(result).toBeNull();
    // 추가 검증: select 체인의 마지막 .for('update')가 호출됐는지는 mock 체인 확장 필요 — 일단 동작 확인만
  });

  it('deleteById는 일치하는 row가 없으면 false를 반환한다', async () => {
    (mockDatabaseService.db.delete as jest.Mock).mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([]) }),
    });
    const result = await repo.deleteById('ghost-id');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL (모듈 없음)**

Run: `cd services/api && npm test -- upload-session.repository`
Expected: FAIL — `Cannot find module './upload-session.repository'`

- [ ] **Step 3: Repository 구현**

`upload-session.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { DatabaseService, RepositoryCore, TransactionContext, uploadSessions, UploadSessions$Insert, UploadSessions$Select } from '@terab/db';
import { and, eq, lt, sql } from 'drizzle-orm';

@Injectable()
export class UploadSessionRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async findById(id: string): Promise<UploadSessions$Select | null> {
    const [row = null] = await this.conn.select().from(uploadSessions).where(eq(uploadSessions.id, id)).limit(1);
    return row;
  }

  async findByIdForUpdate(id: string): Promise<UploadSessions$Select | null> {
    const [row = null] = await this.conn.select().from(uploadSessions).where(eq(uploadSessions.id, id)).limit(1).for('update');
    return row;
  }

  async insert(data: UploadSessions$Insert): Promise<UploadSessions$Select> {
    const [row] = await this.conn.insert(uploadSessions).values(data).returning();
    return row;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.conn.delete(uploadSessions).where(eq(uploadSessions.id, id)).returning({ id: uploadSessions.id });
    return result.length > 0;
  }

  async findExpiredForCleanup(graceMs: number, limit: number): Promise<UploadSessions$Select[]> {
    // expires_at + graceMs interval < now()
    return this.conn
      .select()
      .from(uploadSessions)
      .where(lt(sql`${uploadSessions.expiresAt} + (${graceMs} * interval '1 millisecond')`, sql`now()`))
      .limit(limit)
      .for('update', { skipLocked: true });
  }
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- upload-session.repository`
Expected: 인스턴스 + findById null + deleteById false 케이스 통과. findByIdForUpdate는 실제 SQL 호출 검증이 mock 한계로 일부만 됨 — 통합 테스트에서 보강.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/upload-session.repository.ts services/api/src/file/upload-session.repository.spec.ts
git commit -m "feat(api): UploadSessionRepository 구현 (FOR UPDATE / SKIP LOCKED 포함)"
```

---

### Task 10: FolderService.assertBelongsToUser

**Files:**

- Modify: `services/api/src/folder/folder.service.ts`
- Modify: `services/api/src/folder/folder.service.spec.ts`

- [ ] **Step 1: spec에 실패 케이스 추가**

`folder.service.spec.ts`에 다음 추가 (적절한 describe 블록 안에):

```ts
describe('assertBelongsToUser', () => {
  it('폴더가 없으면 FOLDER_NOT_FOUND를 던진다', async () => {
    mockFolderRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(service.assertBelongsToUser('ghost', 'u1')).rejects.toThrow(ApiException);
    await expect(service.assertBelongsToUser('ghost', 'u1')).rejects.toMatchObject({ errorCode: 'FOLDER_NOT_FOUND' });
  });

  it('폴더가 존재하면 정상 종료한다', async () => {
    mockFolderRepository.findByIdAndUser.mockResolvedValue({ id: 'f1' });
    await expect(service.assertBelongsToUser('f1', 'u1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `cd services/api && npm test -- folder.service`
Expected: `assertBelongsToUser is not a function`

- [ ] **Step 3: 구현**

`folder.service.ts`에 메서드 추가 (다른 public 메서드 사이 적절한 위치):

```ts
async assertBelongsToUser(folderId: string, userId: string): Promise<void> {
  const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
  if (!folder) throw new ApiException('FOLDER_NOT_FOUND');
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- folder.service`
Expected: 신규 2개 케이스 통과

- [ ] **Step 5: Commit**

```bash
git add services/api/src/folder/folder.service.ts services/api/src/folder/folder.service.spec.ts
git commit -m "feat(api): FolderService.assertBelongsToUser 추가"
```

---

### Task 11: UploadSessionService — init() 단일 PUT 경로

**Files:**

- Create: `services/api/src/file/upload-session.service.ts`
- Create: `services/api/src/file/upload-session.service.spec.ts`

- [ ] **Step 1: spec 작성 — 실패 케이스 + 단일 PUT 성공**

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockUploadSessionSingle } from '@terab/test';
import { FileRepository } from './file.repository';
import { UploadSessionRepository } from './upload-session.repository';
import { UploadSessionService } from './upload-session.service';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';

const mockUploadSessionRepository = {
  findById: jest.fn(),
  findByIdForUpdate: jest.fn(),
  insert: jest.fn(),
  deleteById: jest.fn(),
  findExpiredForCleanup: jest.fn(),
};

const mockFileRepository = {
  insert: jest.fn(),
  toFileItem: jest.fn((row) => ({ ...row, folderId: row.folderId ?? null })),
};

const mockFolderService = {
  assertBelongsToUser: jest.fn(),
};

const mockMinioService = {
  bucketName: 'drive',
  presignedPutObject: jest.fn(),
  createMultipartUpload: jest.fn(),
  presignedPutPart: jest.fn(),
  completeMultipartUpload: jest.fn(),
  abortMultipartUpload: jest.fn(),
  statObject: jest.fn(),
  removeObject: jest.fn(),
};

const mockTransactionContext = {
  current: undefined,
  run: jest.fn((_tx: unknown, fn: () => Promise<unknown>) => fn()),
};

describe('UploadSessionService', () => {
  let service: UploadSessionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: UploadSessionRepository, useValue: mockUploadSessionRepository },
        { provide: FileRepository, useValue: mockFileRepository },
        { provide: FolderService, useValue: mockFolderService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();
    service = module.get(UploadSessionService);
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('size가 100GB를 초과하면 FILE_TOO_LARGE를 던진다', async () => {
      await expect(service.init('u1', { name: 'big.bin', size: 101 * 1024 * 1024 * 1024, mimeType: 'application/octet-stream' })).rejects.toMatchObject({
        errorCode: 'FILE_TOO_LARGE',
      });
    });

    it('folderId가 주어지면 FolderService.assertBelongsToUser를 호출한다', async () => {
      mockFolderService.assertBelongsToUser.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));
      await expect(service.init('u1', { folderId: 'ghost', name: 't.txt', size: 100, mimeType: 'text/plain' })).rejects.toMatchObject({
        errorCode: 'FOLDER_NOT_FOUND',
      });
    });

    it('100MB 미만이면 단일 PUT으로 presigned URL 1개를 발급한다', async () => {
      mockMinioService.presignedPutObject.mockResolvedValue('https://storage.example/put');
      mockUploadSessionRepository.insert.mockResolvedValue(mockUploadSessionSingle);

      const result = await service.init('u1', { name: 't.png', size: 1024, mimeType: 'image/png' });

      expect(mockMinioService.presignedPutObject).toHaveBeenCalledTimes(1);
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].partNumber).toBe(1);
      expect(result.parts[0].uploadUrl).toBe('https://storage.example/put');
      expect(result.uploadHeaders['Content-Type']).toBe('image/png');
      expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ uploadKind: 'single', multipartUploadId: null }));
    });

    it('위험 mime은 application/octet-stream으로 sanitize한다', async () => {
      mockMinioService.presignedPutObject.mockResolvedValue('https://storage.example/put');
      mockUploadSessionRepository.insert.mockResolvedValue(mockUploadSessionSingle);

      const result = await service.init('u1', { name: 'evil.html', size: 100, mimeType: 'text/html' });

      expect(result.uploadHeaders['Content-Type']).toBe('application/octet-stream');
      expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'application/octet-stream' }));
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL (모듈 없음)**

Run: `cd services/api && npm test -- upload-session.service`
Expected: FAIL — `Cannot find module './upload-session.service'`

- [ ] **Step 3: Service 구현 (단일 PUT 경로만)**

```ts
import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { FileItem, UploadCompletePart, UploadInitBody, UploadInitResponse } from '@terab/contract';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomUUID } from 'node:crypto';
import { FolderService } from '../folder/folder.service';
import { MinioService } from '../minio/minio.service';
import { FileRepository } from './file.repository';
import { UploadSessionRepository } from './upload-session.repository';

@Injectable()
export class UploadSessionService extends ServiceCore {
  private readonly TTL_MS = 60 * 60 * 1000;
  private readonly GRACE_MS = 30 * 1000;
  private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  private readonly DEFAULT_PART_SIZE = 100 * 1024 * 1024;
  private readonly MAX_PARTS = 10000;
  private readonly URL_EXPIRY_SEC = 3600;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024;

  private readonly DANGEROUS_MIME_PREFIXES = ['text/html', 'application/javascript', 'text/javascript', 'application/xhtml+xml', 'text/xml', 'application/xml'];

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly fileRepository: FileRepository,
    private readonly folderService: FolderService,
    private readonly minioService: MinioService,
  ) {
    super(database, txContext);
  }

  private sanitizeMime(mimeType: string): string {
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    return this.DANGEROUS_MIME_PREFIXES.includes(normalized) ? 'application/octet-stream' : mimeType;
  }

  async init(userId: string, body: UploadInitBody): Promise<UploadInitResponse> {
    if (body.size > this.MAX_FILE_SIZE) throw new ApiException('FILE_TOO_LARGE');
    if (body.folderId) await this.folderService.assertBelongsToUser(body.folderId, userId);

    const safeMime = this.sanitizeMime(body.mimeType);
    const minioKey = `${userId}/${randomUUID()}`;
    const expiresAt = new Date(Date.now() + this.TTL_MS);

    if (body.size < this.MULTIPART_THRESHOLD) {
      const uploadUrl = await this.minioService.presignedPutObject(minioKey, safeMime, this.URL_EXPIRY_SEC);
      const session = await this.uploadSessionRepository.insert({
        userId,
        folderId: body.folderId ?? null,
        name: body.name,
        size: body.size,
        mimeType: safeMime,
        minioKey,
        uploadKind: 'single',
        multipartUploadId: null,
        expiresAt,
      });
      return {
        sessionId: session.id,
        parts: [{ partNumber: 1, uploadUrl }],
        uploadHeaders: { 'Content-Type': safeMime },
        expiresAt,
      };
    }

    // multipart 경로는 Task 12에서 구현
    throw new Error('multipart not implemented');
  }
}
```

- [ ] **Step 4: 테스트 재실행 → 단일 PUT 케이스 PASS**

Run: `cd services/api && npm test -- upload-session.service`
Expected: 위에 작성한 4개 케이스 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/upload-session.service.ts services/api/src/file/upload-session.service.spec.ts
git commit -m "feat(api): UploadSessionService init() 단일 PUT 경로 구현"
```

---

### Task 12: UploadSessionService — init() multipart 경로

**Files:**

- Modify: `services/api/src/file/upload-session.service.ts`
- Modify: `services/api/src/file/upload-session.service.spec.ts`

- [ ] **Step 1: spec에 multipart 케이스 추가**

`describe('init', ...)` 안에 다음 추가:

```ts
it('100MB 이상이면 multipart로 part별 presigned URL을 발급한다', async () => {
  mockMinioService.createMultipartUpload.mockResolvedValue({ uploadId: 'mp-1' });
  mockMinioService.presignedPutPart.mockImplementation(async (_k, _u, partNumber: number) => `https://storage.example/part/${partNumber}`);
  mockUploadSessionRepository.insert.mockResolvedValue({
    ...mockUploadSessionSingle,
    uploadKind: 'multipart',
    multipartUploadId: 'mp-1',
  });

  const size = 250 * 1024 * 1024;
  const result = await service.init('u1', { name: 'v.mp4', size, mimeType: 'video/mp4' });

  // 100MB part size → 3 parts
  expect(mockMinioService.createMultipartUpload).toHaveBeenCalledWith(expect.any(String), 'video/mp4');
  expect(result.parts).toHaveLength(3);
  expect(result.parts.map((p) => p.partNumber)).toEqual([1, 2, 3]);
  expect(mockUploadSessionRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ uploadKind: 'multipart', multipartUploadId: 'mp-1' }));
});

it('5TB 가까운 size에도 MAX_PARTS=10000을 넘지 않도록 part size를 조정한다', async () => {
  // 이 케이스는 100GB cap에 의해 도달 불가하지만 partSize 공식 검증용
  // 100GB / 100MB = 1024 parts
  mockMinioService.createMultipartUpload.mockResolvedValue({ uploadId: 'mp-2' });
  mockMinioService.presignedPutPart.mockResolvedValue('https://storage.example/part');
  mockUploadSessionRepository.insert.mockResolvedValue({ ...mockUploadSessionSingle, uploadKind: 'multipart' });

  const size = 100 * 1024 * 1024 * 1024; // 100GB
  const result = await service.init('u1', { name: 'big.bin', size, mimeType: 'application/octet-stream' });

  expect(result.parts.length).toBeLessThanOrEqual(10000);
  expect(result.parts.length).toBe(1024);
});
```

- [ ] **Step 2: 테스트 실행 → FAIL (multipart not implemented)**

Run: `cd services/api && npm test -- upload-session.service`
Expected: multipart 케이스 두 개가 FAIL

- [ ] **Step 3: multipart 경로 구현**

`init()` 메서드 안 `throw new Error('multipart not implemented')` 부분을 다음으로 교체:

```ts
// Multipart 경로
const partSize = Math.max(this.DEFAULT_PART_SIZE, Math.ceil(body.size / 9000));
const partCount = Math.ceil(body.size / partSize);
if (partCount > this.MAX_PARTS) throw new ApiException('FILE_TOO_LARGE');

const { uploadId } = await this.minioService.createMultipartUpload(minioKey, safeMime);
const parts = await Promise.all(
  Array.from({ length: partCount }, async (_, i) => {
    const partNumber = i + 1;
    const uploadUrl = await this.minioService.presignedPutPart(minioKey, uploadId, partNumber, this.URL_EXPIRY_SEC);
    return { partNumber, uploadUrl };
  }),
);

const session = await this.uploadSessionRepository.insert({
  userId,
  folderId: body.folderId ?? null,
  name: body.name,
  size: body.size,
  mimeType: safeMime,
  minioKey,
  uploadKind: 'multipart',
  multipartUploadId: uploadId,
  expiresAt,
});

return {
  sessionId: session.id,
  parts,
  uploadHeaders: { 'Content-Type': safeMime },
  expiresAt,
};
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- upload-session.service`
Expected: 신규 multipart 케이스 2개 PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/upload-session.service.ts services/api/src/file/upload-session.service.spec.ts
git commit -m "feat(api): UploadSessionService init() multipart 경로 구현"
```

---

### Task 13: UploadSessionService — complete() 핵심 경로

**Files:**

- Modify: `services/api/src/file/upload-session.service.ts`
- Modify: `services/api/src/file/upload-session.service.spec.ts`

- [ ] **Step 1: spec에 complete 케이스 추가**

```ts
describe('complete', () => {
  it('session이 없으면 UPLOAD_SESSION_NOT_FOUND를 던진다', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(null);
    await expect(service.complete('u1', 'ghost-id', [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
      errorCode: 'UPLOAD_SESSION_NOT_FOUND',
    });
  });

  it('session 소유자가 다르면 UPLOAD_SESSION_NOT_FOUND를 던진다 (정보 누출 차단)', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue({
      ...mockUploadSessionSingle,
      userId: 'other-user',
    });
    await expect(service.complete('u1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
      errorCode: 'UPLOAD_SESSION_NOT_FOUND',
    });
  });

  it('만료된 session이고 객체도 없으면 UPLOAD_SESSION_EXPIRED를 던진다', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionExpired);
    mockMinioService.statObject.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
    await expect(service.complete('uuid-1', mockUploadSessionExpired.id, [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
      errorCode: 'UPLOAD_SESSION_EXPIRED',
    });
  });

  it('statObject가 NoSuchKey면 UPLOAD_OBJECT_MISSING을 던진다', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle);
    mockMinioService.statObject.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
    await expect(service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
      errorCode: 'UPLOAD_OBJECT_MISSING',
    });
  });

  it('size 불일치이면 UPLOAD_SIZE_MISMATCH + removeObject 호출', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle); // size: 1024
    mockMinioService.statObject.mockResolvedValue({ size: 2048, mimeType: 'image/png' });
    await expect(service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }])).rejects.toMatchObject({
      errorCode: 'UPLOAD_SIZE_MISMATCH',
    });
    expect(mockMinioService.removeObject).toHaveBeenCalledWith(mockUploadSessionSingle.minioKey);
  });

  it('단일 PUT 성공 시 files row INSERT + session DELETE', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionSingle);
    mockMinioService.statObject.mockResolvedValue({ size: 1024, mimeType: 'image/png' });
    mockFileRepository.insert.mockResolvedValue({
      id: 'new-file-id',
      userId: 'uuid-1',
      folderId: null,
      name: 'test.png',
      minioKey: mockUploadSessionSingle.minioKey,
      size: 1024,
      mimeType: 'image/png',
      softDeletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUploadSessionRepository.deleteById.mockResolvedValue(true);

    const result = await service.complete('uuid-1', mockUploadSessionSingle.id, [{ partNumber: 1, etag: 'e' }]);

    expect(mockMinioService.completeMultipartUpload).not.toHaveBeenCalled();
    expect(mockFileRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'uuid-1',
        name: 'test.png',
        minioKey: mockUploadSessionSingle.minioKey,
        size: 1024,
        mimeType: 'image/png',
      }),
    );
    expect(mockUploadSessionRepository.deleteById).toHaveBeenCalledWith(mockUploadSessionSingle.id);
    expect(result.name).toBe('test.png');
  });

  it('multipart 성공 시 completeMultipartUpload 호출 후 files INSERT', async () => {
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(mockUploadSessionMultipart);
    mockMinioService.statObject.mockResolvedValue({ size: 150 * 1024 * 1024, mimeType: 'image/png' });
    mockFileRepository.insert.mockResolvedValue({
      id: 'new-file-id',
      userId: 'uuid-1',
      folderId: null,
      name: 'test.png',
      minioKey: mockUploadSessionMultipart.minioKey,
      size: 150 * 1024 * 1024,
      mimeType: 'image/png',
      softDeletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.complete('uuid-1', mockUploadSessionMultipart.id, [
      { partNumber: 1, etag: 'e1' },
      { partNumber: 2, etag: 'e2' },
    ]);

    expect(mockMinioService.completeMultipartUpload).toHaveBeenCalledWith(mockUploadSessionMultipart.minioKey, 'multipart-upload-id-1', [
      { partNumber: 1, etag: 'e1' },
      { partNumber: 2, etag: 'e2' },
    ]);
  });

  it('grace period: 만료지만 객체가 있으면 정상 처리한다', async () => {
    // expires_at이 25초 전 (grace 30초 내)
    const recentlyExpired = {
      ...mockUploadSessionSingle,
      expiresAt: new Date(Date.now() - 25 * 1000),
    };
    mockUploadSessionRepository.findByIdForUpdate.mockResolvedValue(recentlyExpired);
    mockMinioService.statObject.mockResolvedValue({ size: 1024, mimeType: 'image/png' });
    mockFileRepository.insert.mockResolvedValue({
      id: 'new-file-id',
      userId: 'uuid-1',
      folderId: null,
      name: 'test.png',
      minioKey: recentlyExpired.minioKey,
      size: 1024,
      mimeType: 'image/png',
      softDeletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.complete('uuid-1', recentlyExpired.id, [{ partNumber: 1, etag: 'e' }]);
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL (complete 없음)**

- [ ] **Step 3: complete 구현**

`UploadSessionService`에 메서드 추가:

```ts
async complete(userId: string, sessionId: string, parts: UploadCompletePart[]): Promise<FileItem> {
  return this.runInTx(async () => {
    const session = await this.uploadSessionRepository.findByIdForUpdate(sessionId);
    if (!session || session.userId !== userId) throw new ApiException('UPLOAD_SESSION_NOT_FOUND');

    const now = Date.now();
    const expired = session.expiresAt.getTime() + this.GRACE_MS < now;

    if (expired) {
      // grace 안에서도 객체가 있으면 진행, 없으면 만료 처리
      const exists = await this.minioService.statObject(session.minioKey).catch(() => null);
      if (!exists) {
        await this.uploadSessionRepository.deleteById(session.id).catch(() => undefined);
        throw new ApiException('UPLOAD_SESSION_EXPIRED');
      }
    }

    if (session.uploadKind === 'multipart') {
      if (!session.multipartUploadId) throw new ApiException('UPLOAD_OBJECT_MISSING');
      await this.minioService.completeMultipartUpload(session.minioKey, session.multipartUploadId, parts);
    }

    const stat = await this.minioService.statObject(session.minioKey).catch((err: unknown) => {
      // minio-js의 에러 코드 노출: err.code === 'NoSuchKey' 또는 message
      const code = (err as { code?: string } | null)?.code;
      if (code === 'NoSuchKey' || (err instanceof Error && err.message.includes('NoSuchKey'))) {
        return null;
      }
      throw err;
    });
    if (!stat) throw new ApiException('UPLOAD_OBJECT_MISSING');

    if (stat.size !== session.size) {
      await this.minioService.removeObject(session.minioKey).catch(() => undefined);
      await this.uploadSessionRepository.deleteById(session.id).catch(() => undefined);
      throw new ApiException('UPLOAD_SIZE_MISMATCH');
    }

    const row = await this.fileRepository.insert({
      userId,
      folderId: session.folderId,
      name: session.name,
      minioKey: session.minioKey,
      size: session.size,
      mimeType: session.mimeType,
    });
    await this.uploadSessionRepository.deleteById(session.id);
    return this.fileRepository.toFileItem(row);
  });
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- upload-session.service`
Expected: complete 케이스 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/upload-session.service.ts services/api/src/file/upload-session.service.spec.ts
git commit -m "feat(api): UploadSessionService complete() 구현 (단일/multipart + grace + 실패 처리)"
```

---

### Task 14: UploadSessionService — cleanupExpired()

**Files:**

- Modify: `services/api/src/file/upload-session.service.ts`
- Modify: `services/api/src/file/upload-session.service.spec.ts`

- [ ] **Step 1: spec에 cleanup 케이스 추가**

```ts
describe('cleanupExpired', () => {
  it('만료 single session은 removeObject + deleteById를 호출한다', async () => {
    mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([mockUploadSessionExpired]);
    mockUploadSessionRepository.deleteById.mockResolvedValue(true);

    const stats = await service.cleanupExpired(500);

    expect(mockMinioService.removeObject).toHaveBeenCalledWith(mockUploadSessionExpired.minioKey);
    expect(mockMinioService.abortMultipartUpload).not.toHaveBeenCalled();
    expect(mockUploadSessionRepository.deleteById).toHaveBeenCalledWith(mockUploadSessionExpired.id);
    expect(stats.deleted).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('만료 multipart session은 abortMultipartUpload + removeObject + deleteById를 호출한다', async () => {
    const expiredMp = { ...mockUploadSessionMultipart, expiresAt: new Date('2020-01-01') };
    mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([expiredMp]);
    mockUploadSessionRepository.deleteById.mockResolvedValue(true);

    const stats = await service.cleanupExpired(500);

    expect(mockMinioService.abortMultipartUpload).toHaveBeenCalledWith(expiredMp.minioKey, expiredMp.multipartUploadId);
    expect(mockMinioService.removeObject).toHaveBeenCalledWith(expiredMp.minioKey);
    expect(stats.deleted).toBe(1);
  });

  it('MinIO 에러가 나도 deleteById는 진행하고 errors 카운트만 증가', async () => {
    mockUploadSessionRepository.findExpiredForCleanup.mockResolvedValue([mockUploadSessionExpired]);
    mockMinioService.removeObject.mockRejectedValue(new Error('boom'));
    mockUploadSessionRepository.deleteById.mockResolvedValue(true);

    const stats = await service.cleanupExpired(500);

    expect(mockUploadSessionRepository.deleteById).toHaveBeenCalled();
    expect(stats.errors).toBe(1);
    expect(stats.deleted).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: 구현**

```ts
async cleanupExpired(batchSize: number): Promise<{ scanned: number; deleted: number; errors: number }> {
  const sessions = await this.uploadSessionRepository.findExpiredForCleanup(this.GRACE_MS, batchSize);
  let deleted = 0;
  let errors = 0;
  for (const session of sessions) {
    try {
      if (session.uploadKind === 'multipart' && session.multipartUploadId) {
        await this.minioService.abortMultipartUpload(session.minioKey, session.multipartUploadId).catch(() => {
          errors += 1;
        });
      }
      await this.minioService.removeObject(session.minioKey).catch(() => {
        errors += 1;
      });
    } catch {
      errors += 1;
    }
    await this.uploadSessionRepository.deleteById(session.id);
    deleted += 1;
  }
  return { scanned: sessions.length, deleted, errors };
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- upload-session.service`
Expected: cleanupExpired 3개 케이스 PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/upload-session.service.ts services/api/src/file/upload-session.service.spec.ts
git commit -m "feat(api): UploadSessionService.cleanupExpired 구현 (single/multipart 분기 + 에러 swallow)"
```

---

## Phase 4 — Controller & Module 통합

### Task 15: FileUploadController

**Files:**

- Create: `services/api/src/file/file-upload.controller.ts`
- Create: `services/api/src/file/file-upload.controller.spec.ts`

- [ ] **Step 1: controller spec 작성**

```ts
import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { FileUploadController } from './file-upload.controller';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionService = {
  init: jest.fn(),
  complete: jest.fn(),
};

describe('FileUploadController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [FileUploadController],
      providers: [
        { provide: UploadSessionService, useValue: mockUploadSessionService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockAuthUser;
              return true;
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('인스턴스가 생성된다', () => {
    expect(app).toBeDefined();
  });

  it('POST /files/upload-init은 service.init을 호출하고 201을 반환한다', async () => {
    mockUploadSessionService.init.mockResolvedValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      parts: [{ partNumber: 1, uploadUrl: 'https://storage.example/put' }],
      uploadHeaders: { 'Content-Type': 'image/png' },
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .post('/files/upload-init')
      .send({ name: 't.png', size: 1024, mimeType: 'image/png' })
      .expect(HttpStatus.CREATED);

    expect(mockUploadSessionService.init).toHaveBeenCalledWith(
      mockAuthUser.userId,
      expect.objectContaining({
        name: 't.png',
        size: 1024,
        mimeType: 'image/png',
      }),
    );
    expect(res.body.sessionId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('POST /files/:sessionId/upload-complete는 service.complete를 호출한다', async () => {
    const sessionId = '11111111-1111-1111-1111-111111111111';
    mockUploadSessionService.complete.mockResolvedValue({
      id: 'file-id',
      name: 't.png',
      folderId: null,
      size: 1024,
      mimeType: 'image/png',
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .post(`/files/${sessionId}/upload-complete`)
      .send({ parts: [{ partNumber: 1, etag: 'e' }] })
      .expect(HttpStatus.CREATED);

    expect(mockUploadSessionService.complete).toHaveBeenCalledWith(mockAuthUser.userId, sessionId, [{ partNumber: 1, etag: 'e' }]);
    expect(res.body.id).toBe('file-id');
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: Controller 구현**

```ts
import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UploadSessionService } from './upload-session.service';

@Controller()
export class FileUploadController {
  constructor(private readonly uploadSessionService: UploadSessionService) {}

  @TsRestHandler(contract.file.uploadInit)
  handleInit(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.uploadInit, async ({ body }) => {
      const result = await this.uploadSessionService.init(user.userId, body);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.file.uploadComplete)
  handleComplete(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.uploadComplete, async ({ params, body }) => {
      const result = await this.uploadSessionService.complete(user.userId, params.sessionId, body.parts);
      return { status: HttpStatus.CREATED, body: result };
    });
  }
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- file-upload.controller`

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/file-upload.controller.ts services/api/src/file/file-upload.controller.spec.ts
git commit -m "feat(api): FileUploadController 추가 (uploadInit/uploadComplete)"
```

---

### Task 16: 기존 upload 핸들러·서비스·스토리지엔진 제거

**Files:**

- Modify: `services/api/src/file/file.controller.ts`
- Modify: `services/api/src/file/file.controller.spec.ts`
- Modify: `services/api/src/file/file.service.ts`
- Modify: `services/api/src/file/file.service.spec.ts`
- Delete: `services/api/src/minio/minio-storage.engine.ts`

- [ ] **Step 1: FileController에서 handleUpload 제거**

`file.controller.ts`에서:

- `import { FileInterceptor } from '@nestjs/platform-express';` 라인 제거
- `import { UploadedFile, UseInterceptors } from '@nestjs/common'` 부분에서 `UploadedFile, UseInterceptors` 제거 (남는 import만 유지)
- `handleUpload` 메서드 전체 제거

- [ ] **Step 2: FileService.upload() 제거**

`file.service.ts`에서:

- `upload()` 메서드 제거
- `extension as mimeExtension`, `extname`, `Readable`, `sanitizeFilename` import는 다른 메서드(`ensureExtension` 등)가 여전히 사용 중이면 유지

- [ ] **Step 3: file.service.spec.ts에서 upload 테스트 제거**

`file.service.spec.ts`에서 `describe('upload', ...)` 블록 전체 또는 upload 관련 `it` 케이스 제거. `mockFileService.upload`도 mock 객체에서 제거.

- [ ] **Step 4: file.controller.spec.ts에서 upload 테스트 제거**

`describe('POST /files (업로드)', ...)` 블록 전체 제거. mock에서도 `upload: jest.fn()` 제거.

- [ ] **Step 5: MinioStorageEngine 삭제**

```bash
rm services/api/src/minio/minio-storage.engine.ts
```

(같은 디렉토리에 `minio-storage.engine.spec.ts`가 있다면 함께 삭제)

- [ ] **Step 6: 테스트 + 빌드 확인**

Run: `cd services/api && npm run build && npm test -- file.controller file.service`
Expected: 빌드 성공, 두 spec 모두 통과

- [ ] **Step 7: Commit**

```bash
git add services/api/src/file/file.controller.ts \
        services/api/src/file/file.controller.spec.ts \
        services/api/src/file/file.service.ts \
        services/api/src/file/file.service.spec.ts \
        services/api/src/minio/minio-storage.engine.ts
git commit -m "refactor(api): FileInterceptor 기반 업로드 제거 (MinioStorageEngine 삭제 포함)"
```

---

### Task 17: FileModule 재구성

**Files:**

- Modify: `services/api/src/file/file.module.ts`

- [ ] **Step 1: FileModule 교체**

`file.module.ts` 전체 교체:

```ts
import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { FolderModule } from '../folder/folder.module';
import { FileDownloadController } from './file-download.controller';
import { FileUploadController } from './file-upload.controller';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { UploadSessionCleanupWorker } from './upload-session.cleanup.worker';
import { UploadSessionRepository } from './upload-session.repository';
import { UploadSessionService } from './upload-session.service';

@Module({
  imports: [forwardRef(() => FolderModule), BullModule.registerQueue({ name: 'upload-session-cleanup' })],
  controllers: [FileController, FileDownloadController, FileUploadController],
  providers: [FileService, FileRepository, UploadSessionService, UploadSessionRepository, UploadSessionCleanupWorker],
  exports: [FileService],
})
export class FileModule {}
```

> **참고**: `FolderModule`이 이미 `FileModule`을 import하고 있으므로 (FolderService → FileService 의존), 양방향이 되며 `forwardRef`가 필요하다. FolderModule 쪽에서는 이미 `imports: [FileModule]`로 import되어 있어, 한쪽만 forwardRef로 바꿔주면 충분하다.

- [ ] **Step 2: FolderModule도 forwardRef 적용 (순환 해결)**

`services/api/src/folder/folder.module.ts`:

```ts
import { forwardRef, Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

@Module({
  imports: [forwardRef(() => FileModule)],
  controllers: [FolderController],
  providers: [FolderService, FolderRepository],
  exports: [FolderService],
})
export class FolderModule {}
```

- [ ] **Step 3: UploadSessionService에서 FolderService 주입에 forwardRef 사용**

`upload-session.service.ts`의 import:

```ts
import { forwardRef, Inject, Injectable } from '@nestjs/common';
```

constructor:

```ts
constructor(
  database: DatabaseService,
  txContext: TransactionContext,
  private readonly uploadSessionRepository: UploadSessionRepository,
  private readonly fileRepository: FileRepository,
  @Inject(forwardRef(() => FolderService)) private readonly folderService: FolderService,
  private readonly minioService: MinioService,
) { super(database, txContext); }
```

- [ ] **Step 4: 빌드 + 전체 테스트 실행**

Run: `cd services/api && npm run build && npm test`
Expected: 빌드 성공, 모든 단위 테스트 PASS. 이 시점에 API의 기존 업로드 엔드포인트는 사라지고 새 엔드포인트가 등장한다.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/file/file.module.ts \
        services/api/src/folder/folder.module.ts \
        services/api/src/file/upload-session.service.ts
git commit -m "refactor(api): FileModule에 UploadSession providers 등록 + 순환 의존 forwardRef 적용"
```

---

## Phase 5 — Cleanup Worker

### Task 18: UploadSessionCleanupWorker

**Files:**

- Create: `services/api/src/file/upload-session.cleanup.worker.ts`
- Create: `services/api/src/file/upload-session.cleanup.worker.spec.ts`

- [ ] **Step 1: worker spec 작성**

```ts
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider } from '@terab/test';
import { UploadSessionCleanupWorker } from './upload-session.cleanup.worker';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionService = {
  cleanupExpired: jest.fn(),
};

const mockQueue = {
  removeJobScheduler: jest.fn(),
  add: jest.fn(),
};

describe('UploadSessionCleanupWorker', () => {
  let worker: UploadSessionCleanupWorker;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionCleanupWorker,
        { provide: UploadSessionService, useValue: mockUploadSessionService },
        { provide: getQueueToken('upload-session-cleanup'), useValue: mockQueue },
        createPinoLoggerProvider(UploadSessionCleanupWorker.name),
      ],
    }).compile();
    worker = module.get(UploadSessionCleanupWorker);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(worker).toBeDefined();
  });

  it('process는 cleanupExpired(500)을 호출한다', async () => {
    mockUploadSessionService.cleanupExpired.mockResolvedValue({ scanned: 0, deleted: 0, errors: 0 });
    await worker.process({ data: {} } as any);
    expect(mockUploadSessionService.cleanupExpired).toHaveBeenCalledWith(500);
  });

  it('onApplicationBootstrap는 이전 repeatable 제거 후 새로 등록한다', async () => {
    await worker.onApplicationBootstrap();
      expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith('upload-session-cleanup-tick');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'upload-session-cleanup-tick',
      {},
      expect.objectContaining({
        jobId: 'upload-session-cleanup-tick',
        repeat: { every: 15 * 60 * 1000 },
      }),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

- [ ] **Step 3: Worker 구현**

```ts
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UploadSessionService } from './upload-session.service';

@Processor('upload-session-cleanup')
export class UploadSessionCleanupWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly TICK_JOB_ID = 'upload-session-cleanup-tick';
  private readonly TICK_INTERVAL_MS = 15 * 60 * 1000;
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectQueue('upload-session-cleanup') private readonly queue: Queue,
    private readonly uploadSessionService: UploadSessionService,
    @InjectPinoLogger(UploadSessionCleanupWorker.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 이전 등록을 정리 후 새로 등록 — 옵션 변경 시 누적 방지
    await this.queue.removeJobScheduler(this.TICK_JOB_ID).catch(() => undefined);
    await this.queue.add(
      this.TICK_JOB_ID,
      {},
      {
        jobId: this.TICK_JOB_ID,
        repeat: { every: this.TICK_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async process(job: Job): Promise<void> {
    const stats = await this.uploadSessionService.cleanupExpired(this.BATCH_SIZE);
    this.logger.info({ jobId: job.id, ...stats }, 'upload session 회수 결과');
  }
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/api && npm test -- upload-session.cleanup.worker`

- [ ] **Step 5: 빌드 확인 (Module은 이미 등록됨)**

Run: `cd services/api && npm run build`
Expected: 빌드 성공

- [ ] **Step 6: Commit**

```bash
git add services/api/src/file/upload-session.cleanup.worker.ts \
        services/api/src/file/upload-session.cleanup.worker.spec.ts
git commit -m "feat(api): UploadSessionCleanupWorker (BullMQ 15분 주기) 추가"
```

---

### Task 19: 로컬에서 수동 cleanup 검증

**Files:** (코드 변경 없음 — 검증 절차)

- [ ] **Step 1: 인프라 기동**

Run: `make infra && make api`
Expected: API, Postgres, Redis, MinIO 정상 부팅

- [ ] **Step 2: 만료 session 강제 생성**

API가 로컬 5432에 연결된 상태에서 psql로 직접 row 삽입:

```sql
INSERT INTO upload_sessions (user_id, name, size, mime_type, minio_key, upload_kind, expires_at)
SELECT id, 'expired.txt', 100, 'text/plain', id::text || '/expired-test', 'single', NOW() - INTERVAL '2 hours'
FROM users LIMIT 1;
```

- [ ] **Step 3: BullMQ job 즉시 트리거 (선택)**

Redis CLI 또는 Bull Board가 있다면 `upload-session-cleanup` 큐의 다음 tick까지 대기 (최대 15분). 빠른 확인을 위해 worker 코드의 `TICK_INTERVAL_MS`를 1분으로 임시 단축 후 재배포.

- [ ] **Step 4: 결과 확인**

```sql
SELECT * FROM upload_sessions WHERE minio_key LIKE '%/expired-test';
```

Expected: 0 rows (워커가 청소함). API 로그에 `upload session 회수 결과 {scanned, deleted, errors}` 출력 확인.

- [ ] **Step 5: TICK_INTERVAL_MS를 다시 15분으로 되돌리기 (commit 안 함)**

---

## Phase 6 — 웹 클라이언트 헬퍼

### Task 20: 클라이언트 헬퍼 — upload-parts (FSD model 세그먼트)

> **FSD 컨벤션**: `features/file-upload/` 슬라이스는 `api/`, `model/`, `ui/` 세그먼트로만 구성한다. 슬라이스 루트에 파일을 두지 않는다.
> API 호출은 `@/shared/api`의 ts-rest react-query 래퍼(`api.xxx.useMutation()`)를 `api/mutation.ts` 안에서만 호출하고, 외부에서 직접 호출하지 않는다.

**Files:**

- Create: `services/web/src/features/file-upload/model/upload-parts.ts`
- Create: `services/web/src/features/file-upload/model/upload-parts.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadParts } from './upload-parts';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = originalFetch;
});

describe('uploadParts', () => {
  it('단일 part는 한 번의 PUT을 실행하고 etag를 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"etag-1"' }),
    });
    global.fetch = fetchMock as any;

    const file = new File([new Uint8Array(1024)], 'a.bin', { type: 'application/octet-stream' });
    const result = await uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://storage.example/put' }], { 'Content-Type': 'application/octet-stream' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ partNumber: 1, etag: 'etag-1' }]);
  });

  it('etag 따옴표를 제거한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"abc"' }),
    }) as any;
    const file = new File([new Uint8Array(10)], 'a.bin');
    const result = await uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' });
    expect(result[0].etag).toBe('abc');
  });

  it('PUT이 4xx로 실패하면 재시도하고 끝까지 실패하면 throw한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    global.fetch = fetchMock as any;
    const file = new File([new Uint8Array(10)], 'a.bin');
    await expect(uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `cd services/web && npm test -- upload-parts`

- [ ] **Step 3: 구현**

```ts
export interface UploadPartInput {
  partNumber: number;
  uploadUrl: string;
}

export interface UploadPartResult {
  partNumber: number;
  etag: string;
}

const MAX_RETRIES = 2;
const PART_CONCURRENCY = 4;

export async function uploadParts(file: File, parts: UploadPartInput[], headers: Record<string, string>): Promise<UploadPartResult[]> {
  const partSize = Math.ceil(file.size / parts.length);
  const queue = [...parts];
  const results: UploadPartResult[] = new Array(parts.length);

  async function putOne(part: UploadPartInput): Promise<void> {
    const start = (part.partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const blob = file.slice(start, end);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const res = await fetch(part.uploadUrl, { method: 'PUT', headers, body: blob });
        if (!res.ok) throw new Error(`PUT failed ${res.status}`);
        const raw = res.headers.get('ETag') ?? res.headers.get('etag') ?? '';
        const etag = raw.replace(/^"+|"+$/g, '');
        results[part.partNumber - 1] = { partNumber: part.partNumber, etag };
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('upload failed');
  }

  // 간단한 동시성 제한
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (next) await putOne(next);
      }
    }),
  );
  return results;
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `cd services/web && npm test -- upload-parts`

- [ ] **Step 5: Commit**

```bash
git add services/web/src/features/file-upload/model/upload-parts.ts \
        services/web/src/features/file-upload/model/upload-parts.test.ts
git commit -m "feat(web): upload-parts 유틸 추가 (병렬 PUT + 지수 백오프 재시도)"
```

---

### Task 21: 업로드 mutation 래퍼 + umbrella 훅 (`useUploadFile`)

> **패턴**: 두 개의 API 호출(`uploadInit` → PUT → `uploadComplete`)을 하나의 `useMutation`으로 감싸는 **umbrella mutation** 패턴을 사용한다.
>
> - `api/mutation.ts`는 react-query 래퍼만 제공 (다른 features와 동일하게 `useXxxMutation` 네이밍)
> - `model/useUploadFile.ts`는 `useMutation({ mutationFn })` 안에서 내부 mutation들의 `mutateAsync`를 await — 콜백 중첩 없이 평탄한 시퀀스
> - 호출부는 `mutate({...}, { onSuccess: sync })` 또는 `await mutateAsync(...)` 자유롭게 선택 가능
> - 단일 `isPending` / `error` / `data`로 UI 표시가 단순

**Files:**

- Create/Modify: `services/web/src/features/file-upload/api/mutation.ts`
- Create: `services/web/src/features/file-upload/model/useUploadFile.ts`
- Create: `services/web/src/features/file-upload/model/useUploadFile.test.ts`
- Modify: `services/web/src/features/file-upload/index.ts`

- [ ] **Step 1: `api/mutation.ts` 작성**

```ts
import { api } from '@/shared/api';

export function useUploadInitMutation() {
  return api.file.uploadInit.useMutation();
}

export function useUploadCompleteMutation() {
  return api.file.uploadComplete.useMutation();
}
```

- [ ] **Step 2: `model/useUploadFile.ts` 작성 (umbrella useMutation)**

```ts
import { useMutation } from '@tanstack/react-query';
import { useUploadCompleteMutation, useUploadInitMutation } from '../api/mutation';
import { uploadParts } from './upload-parts';

export interface UploadFileInput {
  file: File;
  folderId?: string;
}

export function useUploadFile() {
  const initMutation = useUploadInitMutation();
  const completeMutation = useUploadCompleteMutation();

  return useMutation({
    mutationFn: async ({ file, folderId }: UploadFileInput) => {
      const initRes = await initMutation.mutateAsync({
        body: {
          folderId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      });
      if (initRes.status !== 201) {
        throw new Error(`upload-init failed: ${initRes.status}`);
      }
      const init = initRes.body;

      const partResults = await uploadParts(file, init.parts, init.uploadHeaders);

      const completeRes = await completeMutation.mutateAsync({
        params: { sessionId: init.sessionId },
        body: { parts: partResults },
      });
      if (completeRes.status !== 201) {
        throw new Error(`upload-complete failed: ${completeRes.status}`);
      }
      return completeRes.body;
    },
  });
}
```

> **에러 처리 정책**: 중간 실패 시 throw만 한다. 서버의 `UploadSessionCleanupWorker`가 만료된 세션을 회수하므로 클라이언트에서 별도 abort 호출은 하지 않는다.

- [ ] **Step 3: `index.ts` 갱신**

```ts
export { useUploadFile } from './model/useUploadFile';
```

> `api/mutation.ts`는 슬라이스 내부용이므로 export하지 않는다 (FSD 세그먼트 규칙).

- [ ] **Step 4: 훅 테스트 작성 (`model/useUploadFile.test.ts`)**

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeQueryWrapper } from '@/__tests__/wrappers';
import { useUploadFile } from './useUploadFile';

const { mockInitMutate, mockCompleteMutate, mockUploadParts } = vi.hoisted(() => ({
  mockInitMutate: vi.fn(),
  mockCompleteMutate: vi.fn(),
  mockUploadParts: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useUploadInitMutation: () => ({ mutateAsync: mockInitMutate }),
  useUploadCompleteMutation: () => ({ mutateAsync: mockCompleteMutate }),
}));

vi.mock('./upload-parts', () => ({
  uploadParts: mockUploadParts,
}));

beforeEach(() => vi.clearAllMocks());

describe('useUploadFile', () => {
  it('init → uploadParts → complete 순서로 호출하고 결과 body를 반환한다', async () => {
    mockInitMutate.mockResolvedValue({
      status: 201,
      body: {
        sessionId: 'sess-1',
        parts: [{ partNumber: 1, uploadUrl: 'https://x' }],
        uploadHeaders: { 'Content-Type': 'application/octet-stream' },
      },
    });
    mockUploadParts.mockResolvedValue([{ partNumber: 1, etag: 'e1' }]);
    mockCompleteMutate.mockResolvedValue({ status: 201, body: { id: 'file-1', name: 'a.bin' } });

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    const data = await result.current.mutateAsync({ file, folderId: 'folder-1' });

    expect(mockInitMutate).toHaveBeenCalledWith({
      body: { folderId: 'folder-1', name: 'a.bin', size: 10, mimeType: 'application/octet-stream' },
    });
    expect(mockUploadParts).toHaveBeenCalledWith(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' });
    expect(mockCompleteMutate).toHaveBeenCalledWith({
      params: { sessionId: 'sess-1' },
      body: { parts: [{ partNumber: 1, etag: 'e1' }] },
    });
    expect(data).toEqual({ id: 'file-1', name: 'a.bin' });
  });

  it('init이 실패하면 uploadParts/complete을 호출하지 않고 throw한다', async () => {
    mockInitMutate.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    await expect(result.current.mutateAsync({ file })).rejects.toThrow('boom');
    expect(mockUploadParts).not.toHaveBeenCalled();
    expect(mockCompleteMutate).not.toHaveBeenCalled();
  });

  it('uploadParts가 실패하면 complete을 호출하지 않는다 (서버 cleanup-worker가 회수)', async () => {
    mockInitMutate.mockResolvedValue({
      status: 201,
      body: { sessionId: 's', parts: [{ partNumber: 1, uploadUrl: 'x' }], uploadHeaders: {} },
    });
    mockUploadParts.mockRejectedValue(new Error('PUT failed'));

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    await expect(result.current.mutateAsync({ file })).rejects.toThrow('PUT failed');
    expect(mockCompleteMutate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: 테스트 실행 → PASS**

Run: `cd services/web && npm test -- file-upload`

- [ ] **Step 6: 빌드 확인**

Run: `cd services/web && npm run build`

- [ ] **Step 7: Commit**

```bash
git add services/web/src/features/file-upload/api/mutation.ts \
        services/web/src/features/file-upload/model/useUploadFile.ts \
        services/web/src/features/file-upload/model/useUploadFile.test.ts \
        services/web/src/features/file-upload/index.ts
git commit -m "feat(web): useUploadFile 훅 추가 (umbrella useMutation 패턴)"
```

#### 호출부 예시 (참고용 — 별도 task에서 widget/page 구현 시 사용)

```ts
// 옵션 A: 단발 업로드 — onSuccess는 동기 콜백만
const upload = useUploadFile();
upload.mutate(
  { file, folderId },
  { onSuccess: (uploaded) => toast.success(`${uploaded.name} 업로드 완료`) },
);

// 옵션 B: 순차 다중 업로드 — await로 평탄하게
for (const f of files) {
  await upload.mutateAsync({ file: f, folderId });
}
```

---

## Phase 7 — 인프라 (Nginx + MinIO)

### Task 22: Nginx `storage` 서브도메인 설정

**Files:**

- Create: `services/nginx/conf.d/storage.conf` (또는 프로젝트 기존 conf 디렉토리)
- Modify: 기존 API host의 `client_max_body_size`

- [ ] **Step 1: 기존 nginx 구성 위치 확인**

Run: `ls services/nginx/`
실제 디렉토리 구조에 맞춰 `storage.conf` 위치를 정한다.

- [ ] **Step 2: storage.conf 작성**

```nginx
server {
    listen 443 ssl;
    server_name storage.skypark207.com;

    ssl_certificate     /etc/letsencrypt/live/storage.skypark207.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/storage.skypark207.com/privkey.pem;

    client_max_body_size 110G;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    add_header Access-Control-Allow-Origin https://drive.skypark207.com always;
    add_header Access-Control-Allow-Methods 'PUT, GET, HEAD, OPTIONS' always;
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization, x-amz-*, ETag' always;
    add_header Access-Control-Expose-Headers 'ETag' always;

    if ($request_method = OPTIONS) {
        return 204;
    }

    location / {
        proxy_pass http://minio:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 3: 기존 API host의 `client_max_body_size` 축소**

기존 nginx host conf에서 `client_max_body_size`를 `1m`(또는 다른 합리적 작은 값)으로 축소. 기존 multipart 사용처가 없는지 grep으로 확인 후 진행:

Run: `grep -ri 'multipart' services/api/src | grep -v node_modules`
Expected: `MinioStorageEngine` 관련 결과 없음 (Task 16에서 삭제). FileInterceptor 또한 없음 — 안전하게 축소 가능.

- [ ] **Step 4: nginx 설정 syntax 확인**

운영에 배포하기 전 `nginx -t`로 syntax 검증.

- [ ] **Step 5: DNS 등록**

`storage.skypark207.com` A 레코드를 NAS 외부 IP로 등록. SSL 인증서 발급 (`certbot certonly --nginx -d storage.skypark207.com`).

- [ ] **Step 6: Commit (인프라 파일만)**

```bash
git add services/nginx/
git commit -m "feat(nginx): storage 서브도메인 + 기존 host client_max_body_size 축소"
```

---

### Task 23: MinIO bucket lifecycle + CORS 셋업 스크립트

**Files:**

- Create: `scripts/setup-minio.sh`
- Modify: `Makefile`

- [ ] **Step 1: 셋업 스크립트 작성**

```bash
#!/usr/bin/env bash
# MinIO bucket lifecycle + CORS 설정 (멱등성)
# 환경: mc CLI 가 설치되어 있어야 하며, MINIO_* 환경변수가 사용 가능해야 한다.

set -euo pipefail

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT 필요}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER 필요}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD 필요}"
: "${MINIO_DEFAULT_BUCKETS:?MINIO_DEFAULT_BUCKETS 필요}"
: "${WEB_ORIGIN:?WEB_ORIGIN 필요}"

ALIAS=terab
mc alias set "${ALIAS}" "http://${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

# 버킷이 없으면 생성
mc mb --ignore-existing "${ALIAS}/${MINIO_DEFAULT_BUCKETS}"

# Lifecycle: AbortIncompleteMultipartUpload 1일
TMP_LIFECYCLE=$(mktemp)
cat > "${TMP_LIFECYCLE}" <<'JSON'
{
  "Rules": [{
    "ID": "AbortIncompleteMultipartUpload",
    "Status": "Enabled",
    "Filter": { "Prefix": "" },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }]
}
JSON
mc ilm import "${ALIAS}/${MINIO_DEFAULT_BUCKETS}" < "${TMP_LIFECYCLE}"
rm -f "${TMP_LIFECYCLE}"

# CORS
TMP_CORS=$(mktemp)
cat > "${TMP_CORS}" <<JSON
{
  "CORSRules": [{
    "AllowedOrigins": ["${WEB_ORIGIN}"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }]
}
JSON
mc anonymous set-json "${TMP_CORS}" "${ALIAS}/${MINIO_DEFAULT_BUCKETS}" || true
rm -f "${TMP_CORS}"

echo "MinIO 셋업 완료: bucket=${MINIO_DEFAULT_BUCKETS}, lifecycle + CORS 적용"
```

> **주의**: `mc anonymous set-json`은 MinIO 버전에 따라 명령어가 다를 수 있다 (`mc admin bucket cors` 등). 실제 운영 MinIO 버전에 맞춰 명령을 조정하라.

- [ ] **Step 2: 실행 권한 부여 + LF 라인 엔딩 확인**

Run: `chmod +x scripts/setup-minio.sh && file scripts/setup-minio.sh`
Expected: shell script로 인식됨. CRLF면 LF로 변환 (`sed -i 's/\r$//' scripts/setup-minio.sh`).

- [ ] **Step 3: Makefile 타겟 추가**

`Makefile`에 다음 타겟 추가:

```makefile
.PHONY: setup-minio
setup-minio:
	@bash scripts/setup-minio.sh
```

`setup` 타겟이 이미 있다면 그 안에서 호출하도록 dependency 추가.

- [ ] **Step 4: 로컬 검증**

Run: `make infra && make setup-minio`
Expected: "MinIO 셋업 완료..." 출력. 재실행해도 멱등하게 통과 (mc commands가 idempotent).

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-minio.sh Makefile
git commit -m "feat(infra): MinIO bucket lifecycle + CORS 셋업 스크립트 추가"
```

---

## Phase 8 — Manual QA

### Task 24: 전체 흐름 수동 검증

**Files:** (검증 절차만)

- [ ] **Step 1: 단일 PUT (50MB) 정상 흐름**

브라우저에서 작은 파일(이미지) 업로드 → 200 응답, 파일 목록에 즉시 표시 확인. DB `files` row 1개 + `upload_sessions` row 0개.

- [ ] **Step 2: Multipart (150MB) 정상 흐름**

100MB 이상 영상 파일 업로드 → 진행률 표시 (UI가 있다면), complete 후 파일 목록 갱신.

- [ ] **Step 3: complete 누락 시나리오**

브라우저 DevTools로 PUT은 보낸 뒤 complete 호출 전 페이지 새로고침. 1시간 + 30초 + 15분 워커 주기 후 `upload_sessions`와 MinIO에서 모두 정리됐는지 확인.

- [ ] **Step 4: 만료 후 complete 시도**

`upload_sessions`의 `expires_at`을 psql로 강제 과거로 변경 + MinIO에서 객체 수동 삭제 → complete 호출 시 `UPLOAD_SESSION_EXPIRED` 응답.

- [ ] **Step 5: 위험 mime sanitize 검증**

HTML 파일 업로드 → init 응답의 `uploadHeaders['Content-Type']`이 `application/octet-stream`. DB에 저장된 mime도 같음.

- [ ] **Step 6: 100GB 초과 시도**

`size: 110737418240` 파라미터로 init 호출 → `413 FILE_TOO_LARGE` 응답.

- [ ] **Step 7: 다른 사용자의 sessionId로 complete 시도**

A 계정으로 init → 응답의 sessionId를 B 계정으로 complete 호출 → `404 UPLOAD_SESSION_NOT_FOUND` (정보 누출 차단).

---

## 부록 — Type 일관성 체크리스트

작업 진행 중 다음 식별자가 모든 파일에서 동일하게 사용되는지 확인:

| 식별자                                                                                                                                                                                                                | 일관성 검증 대상                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `UploadInitBody`, `UploadInitResponse`, `UploadCompleteBody`, `UploadCompletePart`                                                                                                                                    | `@terab/schema` export + `UploadSessionService` / `FileUploadController` 사용처 |
| `UploadSessions$Insert`, `UploadSessions$Select`                                                                                                                                                                      | `@terab/db` re-export (schema/index.ts)                                         |
| `'single' \| 'multipart'`                                                                                                                                                                                             | DB `upload_kind` 컬럼 값, `init()` insert 시 값, `cleanupExpired()` 분기        |
| 메서드명: `assertBelongsToUser`, `presignedPutObject`, `createMultipartUpload`, `presignedPutPart`, `completeMultipartUpload`, `abortMultipartUpload`, `cleanupExpired`, `findByIdForUpdate`, `findExpiredForCleanup` | 호출처 vs 정의처                                                                |
| 에러 코드 키 (대문자 스네이크): `FILE_TOO_LARGE`, `UPLOAD_SESSION_NOT_FOUND`, `UPLOAD_SESSION_EXPIRED`, `UPLOAD_OBJECT_MISSING`, `UPLOAD_SIZE_MISMATCH`                                                               | ErrorCode enum vs throw 위치                                                    |

---

## Spec Coverage 체크

| Spec 섹션                       | 구현 Task                 |
| ------------------------------- | ------------------------- |
| §1 아키텍처 (전체 흐름)         | Task 1-23 통합            |
| §2 DB 스키마                    | Task 4                    |
| §3 Contract & ErrorCode         | Task 1, 2, 3              |
| §4 서비스/레이어 (Repository)   | Task 9                    |
| §4 서비스/레이어 (Service)      | Task 11, 12, 13, 14       |
| §4 Worker                       | Task 18, 19               |
| §4 Controller                   | Task 15                   |
| §4 Module 변경                  | Task 17                   |
| §4 Cross-domain (FolderService) | Task 10                   |
| §4 MinioService 확장            | Task 6, 7                 |
| §5-A 웹 클라이언트 헬퍼         | Task 20, 21               |
| §5-C Nginx                      | Task 22                   |
| §5-D MinIO lifecycle + CORS     | Task 23                   |
| §5-E 환경변수                   | Task 5                    |
| §6 테스트 전략                  | 각 Task의 Step 1·2에 내장 |
| §7 마이그레이션 순서            | Task 1-24 순서 그대로     |

---

> 본 plan은 spec의 모든 결정을 task-by-task로 풀어낸 것이다. 한 task는 2-5분 단위 step으로 구성돼 있으며, 각 step은 (작성 → 실패 확인 → 구현 → 통과 확인 → commit) TDD 사이클을 따른다.


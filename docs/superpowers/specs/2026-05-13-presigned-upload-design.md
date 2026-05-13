# Presigned URL 기반 파일 업로드 재설계

## 배경 & 문제 정의

현재 파일 업로드는 `FileInterceptor` + `MinioStorageEngine`을 통해 multer가 클라이언트 요청 스트림을 곧바로 MinIO로 pipe하는 구조다. 메모리 효율(스트림)은 확보되지만 다음 문제가 있다.

- multer storage engine이 데이터를 흘리는 동안 컨트롤러/서비스의 사전 검증 로직이 실행될 시점이 없다.
- 컨트롤러 도달 이후 서비스 로직(`FOLDER_NOT_FOUND` 등) throw가 발생해도 MinIO 업로드는 이미 끝나 있다.
- 결과: 비즈니스 예외 = MinIO 객체는 존재 + DB에는 row 없음 = **MinIO와 DB sync 불일치 (orphan)**.

추가로 NAS · Docker Swarm 운영 환경에서 큰 파일이 API 컨테이너의 네트워크 · 메모리를 거치는 부담도 누적된다.

## 목표

1. **DB · MinIO sync 무결성**: 어떤 실패 시나리오에서도 두 저장소가 일관된 상태로 수렴
2. **API 서버 자원 절감**: 파일 바이트가 API를 거치지 않도록 설계
3. **대용량 파일 지원**: 단일 파일 100GB까지 (multipart 도입)
4. **기존 정책 유지**: 위험 mime 타입(`text/html` 등) sanitize 정책 보존

## 비목표 (이번 작업 범위 밖)

- 사용자별 storage quota 제도 (스키마에서 확장 가능하도록 열어둠)
- 업로드 진행률 UI, 드래그앤드롭 등 Frontend Design 영역
- 업로드 재개(resume) 기능 — multipart는 part 단위 재시도까지만 지원

---

## 1. 아키텍처 & 흐름

### 핵심 변화

- 기존 `POST /files` (multipart/form-data + FileInterceptor) **제거**
- 새 3-step 흐름: **Init → Direct PUT (to MinIO) → Complete**
- API 서버는 파일 바이트 흐름에서 완전히 빠짐 (메타데이터 + presigned URL 발급만)
- 단일 PUT(< 100MB) / Multipart(≥ 100MB) 자동 분기

### 전체 흐름 (단일 PUT, < 100MB)

```
Client                        API                      MinIO
  │                            │                         │
  │ ── POST /files/upload-init ──>                       │
  │   { folderId?, name, size, │                         │
  │     mimeType }             │── validate folder ──>   │
  │                            │── INSERT upload_session │
  │                            │── presignedPutObject ──>│
  │   <── { sessionId,         ─│                        │
  │         parts: [{ 1, url }],│                        │
  │         uploadHeaders,     │                         │
  │         expiresAt } ──     │                         │
  │                            │                         │
  │ ─────────── PUT (presigned URL) — file bytes ─────>  │
  │ <─────────── 200 OK, ETag: "..." ─────────────────── │
  │                            │                         │
  │ ── POST /files/:sessionId/upload-complete ──>        │
  │   { parts: [{ 1, etag }] } │── SELECT FOR UPDATE     │
  │                            │── statObject ──>        │
  │                            │   (size cross-check)    │
  │                            │── INSERT files          │
  │                            │── DELETE upload_session │
  │   <── { id, name, ... } ── │                         │
```

### Multipart 흐름 (≥ 100MB)

Init 시점에 `parts` 응답으로 part 개수만큼 presigned URL 배열을 반환. 클라이언트는 part별로 병렬 PUT 후 ETag 수집. Complete API에 모든 part ETag 전달, 서버가 `CompleteMultipartUpload` 호출. 그 외 흐름은 단일 PUT과 동일.

### Part Size 전략

- 임계: `size >= 100MB` → multipart
- 기본 part size: `100MB`
- 최대 part 수: 10,000 (S3 한도)
- `partSize = max(100MB, ceil(size / 9000))` — 9000을 사용하는 이유는 안전 마진. 100GB 상한에서는 1024 parts로 여유가 크다.

### Sync 무결성 다중 안전망

| 안전망 | 역할 | 책임 주체 |
|---|---|---|
| Strict cross-check | complete에서 statObject 결과를 init 선언값(size·mime)과 대조 | `UploadSessionService.complete` |
| Worker 회수 | 만료 session + MinIO orphan을 15분마다 청소 | BullMQ `UploadSessionCleanupWorker` |
| MinIO lifecycle | 24시간 후 미완료 multipart 자동 abort (장기 안전망) | MinIO bucket 설정 |
| DB 락 | complete 진입 시 `SELECT FOR UPDATE` — 워커와 경합 차단 | `UploadSessionRepository` |
| Grace period | 워커는 `expires_at + 30s < now()` 인 session만 회수 대상 | `UploadSessionRepository.findExpiredForCleanup` |

---

## 2. DB 스키마

### 신규: `upload_sessions`

`services/api/src/database/schema/upload-sessions.schema.ts`

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
  (table) => [
    t.index().on(table.userId),
    t.index().on(table.expiresAt),
  ],
);

export type UploadSessions$Insert = typeof uploadSessions.$inferInsert;
export type UploadSessions$Select = typeof uploadSessions.$inferSelect;
```

| 컬럼 | 용도 |
|---|---|
| `id` | session 식별자 (= 클라이언트가 complete에 사용) — `files.id`와 별개 |
| `minioKey` | `{userId}/{uuid}`, files와 동일 패턴 — UUID 생성으로 충돌 회피 |
| `size` | init에서 선언받은 값. complete에서 statObject 결과와 비교 |
| `mimeType` | sanitize **이후** 최종 값. presigned URL 서명에 포함된 값과 동일 |
| `uploadKind` | `'single'` 또는 `'multipart'`. 워커가 abort 분기에 사용 |
| `multipartUploadId` | MinIO `CreateMultipartUpload` 반환값. multipart인 경우만 |
| `expiresAt` | `createdAt + 1h`. 워커가 `expires_at + 30s < now()` 조회 |

**인덱스**: `userId`(권한 검증·조회), `expiresAt`(워커 핵심 워크로드).

**소프트 삭제 사용 안 함** — pending 임시 데이터, hard delete만.

`files` 스키마는 **변경 없음**.

### 마이그레이션
- `npm run db:generate` → `drizzle/`에 SQL 커밋
- `src/database/schema/index.ts`에 `export * from './upload-sessions.schema'` 추가

---

## 3. Contract & ErrorCode

### 스키마 추가 (`packages/contracts/src/schemas/file.schema.ts`)

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
export type UploadInitResponse = z.infer<typeof UploadInitResponseSchema>;
export type UploadCompleteBody = z.infer<typeof UploadCompleteBodySchema>;
```

### Contract 변경 (`packages/contracts/src/contracts/file.contract.ts`)

기존 `upload`(multipart/form-data) 제거하고 두 endpoint로 대체.

```ts
const uploadInit = c.mutation({
  summary: '파일 업로드 세션 생성 (presigned URL 발급)',
  method: 'POST',
  path: '/files/upload-init',
  contentType: 'application/json',
  body: UploadInitBodySchema,
  responses: { [HttpStatus.CREATED]: UploadInitResponseSchema },
  strictStatusCodes: true,
});

const uploadComplete = c.mutation({
  summary: '파일 업로드 완료 (DB 반영)',
  method: 'POST',
  path: '/files/:sessionId/upload-complete',
  pathParams: z.object({ sessionId: z.string().uuid() }),
  contentType: 'application/json',
  body: UploadCompleteBodySchema,
  responses: { [HttpStatus.CREATED]: FileItemSchema },
  strictStatusCodes: true,
});

export const fileContract = c.router({
  uploadInit, uploadComplete, rename, move, copy, remove, search,
});
```

### 신규 ErrorCode (`src/common/exceptions/error-code.enum.ts`)

| 키 | message | status | 발생 조건 |
|---|---|---|---|
| `FILE_TOO_LARGE` | 파일 크기가 한도(100GB)를 초과했습니다. | 413 PAYLOAD_TOO_LARGE | init에서 size > MAX |
| `UPLOAD_SESSION_NOT_FOUND` | 업로드 세션을 찾을 수 없습니다. | 404 NOT_FOUND | complete에서 session 조회 실패·소유자 불일치 |
| `UPLOAD_SESSION_EXPIRED` | 업로드 세션이 만료됐습니다. | 410 GONE | 만료 + statObject 객체 없음 |
| `UPLOAD_OBJECT_MISSING` | 업로드된 파일을 찾을 수 없습니다. | 400 BAD_REQUEST | statObject가 NoSuchKey |
| `UPLOAD_SIZE_MISMATCH` | 업로드된 파일 크기가 선언값과 다릅니다. | 400 BAD_REQUEST | size cross-check 실패 |

### 요청/응답 예시

```jsonc
// POST /files/upload-init  Request
{ "folderId": "abc...", "name": "image.png", "size": 524288, "mimeType": "image/png" }

// 201 Response
{
  "sessionId": "11111111-...",
  "parts": [{ "partNumber": 1, "uploadUrl": "https://storage.skypark207.com/..." }],
  "uploadHeaders": { "Content-Type": "image/png" },
  "expiresAt": "2026-05-13T12:00:00.000Z"
}

// PUT to uploadUrl (client → MinIO 직접)
// 200 OK, response header: ETag: "abcd..."

// POST /files/11111111.../upload-complete  Request
{ "parts": [{ "partNumber": 1, "etag": "abcd..." }] }

// 201 Response — 기존 FileItemSchema 그대로
{ "id": "...", "name": "image.png", "folderId": "...", "size": 524288, ... }
```

---

## 4. 서비스/레이어 설계

### 신규 / 수정 / 삭제 파일

```
services/api/src/
  file/
    upload-session.repository.ts        # 신규
    upload-session.repository.spec.ts   # 신규
    upload-session.service.ts           # 신규
    upload-session.service.spec.ts      # 신규
    upload-session.cleanup.worker.ts    # 신규 (BullMQ @Processor)
    upload-session.cleanup.worker.spec.ts # 신규
    file-upload.controller.ts           # 신규
    file-upload.controller.spec.ts      # 신규
    file.controller.ts                  # 수정 — handleUpload 제거
    file.service.ts                     # 수정 — upload() 제거
    file.module.ts                      # 수정 — MulterModule 제거, BullModule + 신규 provider 등록
  minio/
    minio.service.ts                    # 수정 — presigned/multipart 메서드 추가
    minio-storage.engine.ts             # 삭제
  folder/
    folder.service.ts                   # 수정 — assertBelongsToUser 추가
  database/schema/
    upload-sessions.schema.ts           # 신규
    index.ts                            # 수정 — re-export 추가
```

### `MinioService` 추가 메서드

```ts
// 단일 PUT
presignedPutObject(key: string, mimeType: string, expirySec: number): Promise<string>

// Multipart
createMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }>
presignedPutPart(key: string, uploadId: string, partNumber: number, expirySec: number): Promise<string>
completeMultipartUpload(key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<void>
abortMultipartUpload(key: string, uploadId: string): Promise<void>
```

#### 내부/Public 클라이언트 분리

`MinioService`는 **클라이언트 인스턴스 2개**를 보유한다:

- `client` (내부): `MINIO_ENDPOINT` (예: `minio:9000`) — statObject·copyObject·multipart 호출 등 서버↔MinIO 내부 통신
- `presignClient` (public): `MINIO_PUBLIC_ENDPOINT` (예: `https://storage.skypark207.com`) — presigned URL 발급 전용

이유: presigned URL의 서명은 host를 포함하므로, 서명 host와 클라이언트의 PUT host가 일치해야 한다. 그렇다고 모든 내부 호출을 public host로 보내면 nginx를 거치는 비효율이 생긴다. 두 클라이언트를 분리하면 양쪽 모두 최적이 된다.

### `UploadSessionRepository` (extends RepositoryCore)

```ts
findById(id: string): Promise<UploadSessions$Select | null>
findByIdForUpdate(id: string): Promise<UploadSessions$Select | null>  // SELECT ... FOR UPDATE
insert(input: UploadSessions$Insert): Promise<UploadSessions$Select>
deleteById(id: string): Promise<boolean>
findExpiredForCleanup(graceMs: number, limit: number): Promise<UploadSessions$Select[]>
  // expires_at + graceMs < now() 인 row, FOR UPDATE SKIP LOCKED
```

### `UploadSessionService` (extends ServiceCore)

```ts
private readonly TTL_MS = 60 * 60 * 1000;                    // 1h
private readonly GRACE_MS = 30 * 1000;                       // 30s
private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024;    // 100MB
private readonly DEFAULT_PART_SIZE = 100 * 1024 * 1024;
private readonly MAX_PARTS = 10000;
private readonly URL_EXPIRY_SEC = 3600;

private readonly DANGEROUS_MIME_PREFIXES = [
  'text/html', 'application/javascript', 'text/javascript',
  'application/xhtml+xml', 'text/xml', 'application/xml',
];

constructor(
  database, txContext,
  private readonly uploadSessionRepository: UploadSessionRepository,
  private readonly fileRepository: FileRepository,
  private readonly folderService: FolderService,
  private readonly minioService: MinioService,
) { super(database, txContext); }

async init(userId: string, body: UploadInitBody): Promise<UploadInitResponse>
async complete(userId: string, sessionId: string, parts: UploadCompletePart[]): Promise<FileItem>
async cleanupExpired(batchSize: number): Promise<{ scanned: number; deleted: number; errors: number }>
```

#### `init()` 동작
1. `folderId` 있으면 `folderService.assertBelongsToUser(folderId, userId)` (cross-domain)
2. `sanitizeMime(body.mimeType)` 적용
3. `minioKey = `${userId}/${randomUUID()}``
4. `body.size >= MULTIPART_THRESHOLD` 분기:
   - **단일**: `presignedPutObject` 1개 → `parts: [{ partNumber: 1, uploadUrl }]`, `uploadKind: 'single'`
   - **Multipart**: `createMultipartUpload`로 uploadId 획득 → 필요한 part 수만큼 `presignedPutPart` 호출 (`Promise.all`) → `uploadKind: 'multipart'`, `multipartUploadId` 저장
5. `uploadSessionRepository.insert(...)` (`expiresAt = now + TTL_MS`)
6. 응답 반환

#### `complete()` 동작 (runInTx)
1. `uploadSessionRepository.findByIdForUpdate(sessionId)` → null이면 `UPLOAD_SESSION_NOT_FOUND`
2. `session.userId !== userId` → `UPLOAD_SESSION_NOT_FOUND` (정보 누출 차단)
3. `expires_at + GRACE_MS < now()` → statObject 확인 후 객체 존재 시에만 grace 내 idempotent 복구. 객체도 없으면 `UPLOAD_SESSION_EXPIRED`
4. multipart이면 `completeMultipartUpload(key, uploadId, parts)`; 단일 PUT은 생략
5. `statObject(minioKey)` → NoSuchKey이면 `UPLOAD_OBJECT_MISSING`
6. size 일치 검증 → 불일치면 `removeObject(minioKey).catch(swallow)` 후 `UPLOAD_SIZE_MISMATCH`
7. `fileRepository.insert({ userId, folderId: session.folderId, name: session.name, minioKey, size, mimeType: session.mimeType })`
8. `uploadSessionRepository.deleteById(sessionId)`
9. `fileRepository.toFileItem(row)` 반환

#### `cleanupExpired()` 동작
1. `findExpiredForCleanup(GRACE_MS, batchSize)` — FOR UPDATE SKIP LOCKED
2. 각 row마다:
   - multipart이면 `abortMultipartUpload(key, uploadId).catch(swallow)`
   - 항상 `removeObject(key).catch(swallow)`
   - `deleteById(id)`
3. 통계 반환 (로깅용)

### `UploadSessionCleanupWorker` (@Processor)

- Queue: `upload-session-cleanup`
- API 부팅 시 (`OnApplicationBootstrap`) repeatable job 등록 — `every: 15 * 60 * 1000`, `jobId: 'upload-session-cleanup-tick'` 고정
- 부팅 시 기존 repeatable 등록 정리 후 재등록 (옵션 변경 시 누적 방지)
- `process(job)`: `uploadSessionService.cleanupExpired(500)` 호출 + 결과 로깅

### `FileUploadController`

```ts
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

### Module 변경

- `FileModule`: `MulterModule.registerAsync` **삭제**, `BullModule.registerQueue({ name: 'upload-session-cleanup' })` 추가, `FolderModule` import
- providers 추가: `UploadSessionService`, `UploadSessionRepository`, `UploadSessionCleanupWorker`
- controllers 추가: `FileUploadController`

### Cross-domain

`FolderService.assertBelongsToUser(folderId, userId): Promise<void>` 신규. 존재·소유자 검증 실패 시 `FOLDER_NOT_FOUND` throw. 기존 `fileRepository.folderBelongsToUser` 호출처 정리는 이번 작업 범위 밖.

---

## 5. 클라이언트(Web/Mobile) 흐름 + 인프라 변경

### 5-A) 웹 클라이언트 헬퍼

```ts
async function uploadFile(file: File, folderId?: string): Promise<FileItem> {
  // 1) Init
  const init = await api.file.uploadInit({
    body: {
      folderId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    },
  });

  // 2) PUT — 단일 또는 part별 병렬
  const results = await uploadParts(file, init.parts, init.uploadHeaders);

  // 3) Complete
  const result = await api.file.uploadComplete({
    params: { sessionId: init.sessionId },
    body: { parts: results },
  });
  return result.body;
}
```

#### 핵심 결정
- **재시도**: PUT 실패 시 part 단위 자동 재시도 (지수 백오프 3회). presigned URL 1h 유효.
- **진행률**: `XMLHttpRequest.upload.onprogress` 사용 (fetch는 업로드 progress 미지원).
- **동시 part 수**: 4
- **CORS**: MinIO 버킷 CORS에 web origin 허용 필요

UI/UX (드래그앤드롭, 진행률 UI, 일시정지/취소 등)는 Frontend Design 단계에서 별도 정의.

### 5-B) Mobile

Capacitor Android WebView이므로 Web과 동일 헬퍼 사용. Capacitor `Http` 플러그인 대신 native `fetch`/`XMLHttpRequest`를 사용해야 헤더가 정확히 전달됨 (서명 헤더 보존).

### 5-C) Nginx — `storage.skypark207.com` 가상호스트 신규

```nginx
server {
  listen 443 ssl;
  server_name storage.skypark207.com;

  client_max_body_size 110G;
  proxy_request_buffering off;
  proxy_buffering off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;

  location / {
    proxy_pass http://minio:9000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  add_header Access-Control-Allow-Origin https://terab.skypark207.com always;
  add_header Access-Control-Allow-Methods 'PUT, GET, HEAD, OPTIONS' always;
  add_header Access-Control-Allow-Headers 'Content-Type, Authorization, x-amz-*, ETag' always;
  add_header Access-Control-Expose-Headers 'ETag' always;
}
```

기존 API 호스트의 `client_max_body_size`는 작게 축소 (예: 1MB) — 파일이 더 이상 API를 통과하지 않으므로.

### 5-D) MinIO 설정

#### Bucket Lifecycle
```jsonc
{
  "Rules": [{
    "ID": "AbortIncompleteMultipartUpload",
    "Status": "Enabled",
    "Filter": { "Prefix": "" },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }]
}
```

#### Bucket CORS
```jsonc
{
  "CORSRules": [{
    "AllowedOrigins": ["https://terab.skypark207.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }]
}
```

`scripts/`의 멱등성 `mc` 셋업 스크립트로 등록, `make setup`에 통합.

### 5-E) 환경변수 추가

`api.env.example`, `infra.env.example`에 추가:
```
MINIO_PUBLIC_ENDPOINT=https://storage.skypark207.com
WEB_ORIGIN=https://terab.skypark207.com
```

---

## 6. 테스트 전략

기존 [services/api/.claude/rules/testing.md](../../../services/api/.claude/rules/testing.md) 룰 — 실패 케이스 우선.

### `UploadSessionRepository`
- 인스턴스 생성
- `findById`: 일치 없음 → null
- `findByIdForUpdate`: SELECT ... FOR UPDATE 호출 인자 검증
- `insert`: 정상
- `deleteById`: 미존재 → false, 존재 → true
- `findExpiredForCleanup`: grace 내 row 제외, 만료 row만 반환, SKIP LOCKED 적용

### `UploadSessionService`
- `init` 실패:
  - 폴더 없음 → `FOLDER_NOT_FOUND`
  - size > 100GB → `FILE_TOO_LARGE`
  - 위험 mime → octet-stream으로 sanitize, 응답 헤더에 반영
- `init` 성공:
  - size < 100MB → parts 길이 1, `uploadKind: 'single'`
  - size ≥ 100MB → parts 개수 정확, `uploadKind: 'multipart'`, multipartUploadId 저장
- `complete` 실패:
  - session 없음 → `UPLOAD_SESSION_NOT_FOUND`
  - 소유자 불일치 → `UPLOAD_SESSION_NOT_FOUND`
  - 만료 + 객체 없음 → `UPLOAD_SESSION_EXPIRED`
  - 객체 NoSuchKey → `UPLOAD_OBJECT_MISSING`
  - size 불일치 → `UPLOAD_SIZE_MISMATCH` + `removeObject` 호출됨
- `complete` grace period: 만료지만 grace 내 + 객체 존재 → 정상 처리
- `complete` 성공:
  - 단일 PUT → files insert + session 삭제
  - multipart → `completeMultipartUpload` 호출 + files insert
- `cleanupExpired`:
  - 단일 → removeObject + row 삭제
  - multipart → abortMultipartUpload + removeObject + row 삭제
  - MinIO 에러여도 row 삭제 진행, errors 카운트

### `UploadSessionCleanupWorker`
- `process(job)`이 `cleanupExpired(500)` 호출 검증
- 부팅 시 removeRepeatable → add 시퀀스 검증

### `FileUploadController`
- handleInit / handleComplete가 user.userId를 정확히 service로 전달
- 응답 형태 검증

### `MinioService` 추가 메서드
- `presignedPutObject` 반환 URL host가 `MINIO_PUBLIC_ENDPOINT`
- multipart 메서드들이 minio-js 호출 인자 검증

### 제거되는 테스트
- `file.controller.spec.ts`의 `handleUpload` 케이스
- `file.service.spec.ts`의 `upload()` 케이스
- `MinioStorageEngine` 테스트 (현재 별도 spec 없음)

### 통합/E2E (별도 PR 검토)
- 실제 MinIO 컨테이너로 init → real PUT → complete 흐름 1회
- 만료 session 워커 청소 1회

---

## 7. 마이그레이션 / 작업 순서

implementation plan은 별도지만, 작업 순서는 spec에 포함 — 검증·롤백 단위.

### Step 1 — Contract & Schema (Foundation)
- `packages/contracts` 스키마·contract 추가, `npm run build`
- `upload-sessions.schema.ts` 추가, `db:generate`로 migration 생성
- 기존 `upload` contract 제거

### Step 2 — MinIO 인프라 + 환경변수
- `MINIO_PUBLIC_ENDPOINT`, `WEB_ORIGIN` 환경변수 추가
- `MinioService`에 presigned/multipart 메서드 추가 (`presignClient` 별도)
- minio-js 메서드 호출 단위 테스트
- 이 시점까지 기존 업로드는 계속 동작 (FileInterceptor 그대로)

### Step 3 — Upload Session 도메인 구현
- `UploadSessionRepository` + 테스트
- `UploadSessionService` (init, complete, cleanupExpired) + 테스트
- `FolderService.assertBelongsToUser` 추가
- 신규 ErrorCode 등록
- 라우팅 노출 안 함

### Step 4 — Controller & Module 통합 (단일 deploy 단위 시작)
- `FileUploadController` + 테스트
- `FileModule` 수정 (MulterModule 제거, FileUploadController 등록, providers 추가, FolderModule import)
- `FileController.handleUpload` 제거
- `FileService.upload()` 제거
- `MinioStorageEngine` 삭제
- 이 시점부터 기존 업로드 동작 안 함 — Step 6과 같은 PR이어야 함

### Step 5 — Cleanup Worker
- `BullModule.registerQueue` 등록
- `UploadSessionCleanupWorker` + 테스트
- 부팅 시 repeatable job 등록 hook
- 로컬에서 expiresAt 강제 조정해 워커 청소 검증

### Step 6 — 웹 클라이언트 헬퍼
- `uploadFile(file, folderId?)` 헬퍼
- part 분할·병렬 PUT·재시도·진행률 콜백
- 호출처 신규 추가 (현재 web에 호출 없음)

### Step 7 — 인프라 (Nginx + MinIO)
- `services/nginx/`에 `storage.skypark207.com` 가상호스트 추가
- 기존 API host의 `client_max_body_size` 축소
- `mc` 멱등성 스크립트로 lifecycle + CORS 적용, `make setup` 통합
- DNS 등록 (`storage.skypark207.com` → NAS 외부 IP)

### Step 8 — Manual QA
- 단일 PUT (< 100MB)
- Multipart PUT (≥ 100MB)
- 실패 시나리오: complete 누락, 네트워크 끊김, 만료 후 시도, 위험 mime sanitize
- 워커 orphan 청소 로그 확인

### Rollback
- Step 1~3은 기존 동작 영향 0
- Step 4 이후 revert는 web 클라이언트도 같이 revert 되어야 — 단일 PR로 묶음
- DB migration revert: `DROP TABLE upload_sessions` (임시 데이터라 손실 무관)
- MinIO lifecycle/CORS는 멱등성 스크립트로 즉시 해제

---

## 부록 A — 결정 사항 요약

| 결정 | 선택 | 이유 요약 |
|---|---|---|
| 흐름 패턴 | Init → PUT → Complete (2-Phase) | pending row + orphan 회수 명확성 |
| Pending 저장소 | 별도 `upload_sessions` 테이블 | `files` 모든 쿼리에 status 필터 끼우는 휴먼 에러 표면 차단 |
| 선언/검증 | strict: init에서 size·mime 선언, complete에서 cross-check | quota 사전 검증 가능 + 무결성 강화 |
| MinIO 노출 | `storage.skypark207.com` 서브도메인 | 서명 host와 PUT host 일치 + 내부 트래픽 분리 |
| 회수 메커니즘 | BullMQ 워커 + MinIO lifecycle (이중 안전망) | NAS 디스크 제약, 워커 단일 실패 지점 회피 |
| TTL/Grace | 1h TTL, 30s grace, 15min cron | 클라이언트 retry와 워커 경합 회피 |
| Mime sanitize | init에서 server 측 sanitize, 응답 헤더로 반환 | 기존 정책 보존 + 클라이언트 단순화 |
| Multipart | 100MB 임계 지원 | 영상·아카이브 케어, 100MB 파트 1024개로 100GB 커버 |
| 단일 파일 상한 | 100GB | NAS 디스크 안전장치, 환경변수 조정 가능 |
| 기존 endpoint | 즉시 제거 | sync 결함이 본 작업의 동기 |

## 부록 B — 향후 확장 포인트

- **사용자별 storage quota**: init에서 `userQuotaService.assertCanUpload(userId, size)` 한 줄 추가하면 동작
- **업로드 재개(resume)**: 클라이언트가 sessionId 보관 후 동일 sessionId로 part 재PUT (presigned URL은 1h 내 유효). 1h 초과 시 init 재발급
- **다중 storage 지원**: 메모리에 명시된 미래 drives 테이블 마이그레이션 시, `upload_sessions`에 `driveId` 컬럼 추가

# Phase 4 파일 관리 기능 설계

**날짜:** 2026-05-06
**범위:** DEV-019 ~ DEV-028 (파일 업로드, 다운로드, 폴더 관리, 이동/복사, 이름 변경, 소프트 삭제, 검색, 휴지통)

---

## 배경 및 목표

DEV-017 (초대 기반 회원가입)까지 인증 체계가 완성되었다. Phase 4는 NAS Drive의 핵심 기능인 파일·폴더 CRUD를 구현한다.

**핵심 결정 사항:**

- 파일 업로드: API 서버 Proxy (busboy 스트리밍, 메모리 버퍼링 없음)
- DB 구조: Adjacency List (`parent_id`), 파일·폴더 분리 테이블
- 소유권: `user_id` 직접 참조 (미래 다중 스토리지 확장 시 `drives` 테이블로 마이그레이션 예정)
- 검색: DB 단독 (PostgreSQL `ILIKE`)
- 캐시: Redis (NestJS cache-manager, 폴더 목록 전용)

---

## 1. 데이터 스키마

### 1.1 folders 테이블

```ts
// src/database/schema/folders.schema.ts
export const folders = table(
  'folders',
  {
    id:            t.uuid('id').primaryKey().defaultRandom(),
    userId:        t.uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    parentId:      t.uuid('parent_id').references(() => folders.id, { onDelete: 'cascade' }),
    name:          t.varchar('name', { length: 255 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt:     t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.userId),
    t.index().on(table.parentId),
  ],
);
```

- `parentId = NULL` → 루트 레벨 폴더
- `onDelete: 'cascade'` → 부모 폴더 삭제 시 자식 폴더도 cascade (소프트 삭제는 서비스 레이어에서 처리)

### 1.2 files 테이블

```ts
// src/database/schema/files.schema.ts
export const files = table(
  'files',
  {
    id:            t.uuid('id').primaryKey().defaultRandom(),
    userId:        t.uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    folderId:      t.uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
    name:          t.varchar('name', { length: 255 }).notNull(),
    minioKey:      t.varchar('minio_key', { length: 512 }).notNull().unique(),
    size:          t.bigint('size', { mode: 'number' }).notNull(),
    mimeType:      t.varchar('mime_type', { length: 127 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt:     t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    t.index().on(table.userId),
    t.index().on(table.folderId),
    t.index().on(table.name),
  ],
);
```

- `folderId = NULL` → 루트 레벨 파일
- `onDelete: 'set null'` → 폴더 삭제 시 파일이 루트로 이동하지 않도록 **소프트 삭제는 서비스 레이어에서 cascade 처리** (DB cascade에 의존하지 않음)

### 1.3 MinIO 오브젝트 키 전략

```
형식: {userId}/{uuidv4()}
예시: a1b2c3d4-e5f6.../f9e8d7c6-b5a4...
```

- 파일명을 키에 포함하지 않음 → 이름 변경 시 MinIO 재업로드 불필요
- 사용자별 prefix로 논리적 격리
- MinIO 버킷은 단일 버킷 (`drive`) 사용

---

## 2. API 엔드포인트

### 2.1 폴더 (`/folders`)

| Method | Path | 설명 | 응답 |
|---|---|---|---|
| `GET` | `/folders/root` | 루트 목록 (`parent_id IS NULL`) | `FolderChildrenResponse` |
| `GET` | `/folders/:id/children` | 서브폴더 목록 | `FolderChildrenResponse` |
| `POST` | `/folders` | 폴더 생성 | `FolderResponse` |
| `PATCH` | `/folders/:id` | 이름 변경 | `FolderResponse` |
| `PATCH` | `/folders/:id/move` | 폴더 이동 | `FolderResponse` |
| `DELETE` | `/folders/:id` | 소프트 삭제 | `204` |

**FolderChildrenResponse:**
```ts
{
  folders: FolderItem[],
  files: FileItem[],
}
```
폴더와 파일을 단일 응답으로 반환한다 (드라이브 UI의 혼합 목록 표시 요건).

### 2.2 파일 (`/files`)

| Method | Path | 설명 | 응답 |
|---|---|---|---|
| `POST` | `/files` | 업로드 (multipart/form-data) | `FileResponse` |
| `GET` | `/files/:id/download` | 단일 파일 다운로드 | binary stream |
| `POST` | `/files/download/zip` | 다중 파일 ZIP 다운로드 | zip stream |
| `PATCH` | `/files/:id` | 이름 변경 | `FileResponse` |
| `PATCH` | `/files/:id/move` | 이동 | `FileResponse` |
| `POST` | `/files/:id/copy` | 복사 | `FileResponse` |
| `DELETE` | `/files/:id` | 소프트 삭제 | `204` |
| `GET` | `/files/search` | 파일 검색 | `FileSearchResponse` |

**업로드 요청 body (multipart/form-data):**
```
file:     binary
folderId: string (optional, 없으면 루트)
```

**검색 쿼리 파라미터:**
```
q:        string (검색어, 최소 2자)
scope:    "all" | "folder" (all=전체, folder=특정 폴더 내)
folderId: string (scope=folder 일 때 필수)
```

### 2.3 휴지통 (`/trash`)

| Method | Path | 설명 | 응답 |
|---|---|---|---|
| `GET` | `/trash` | 소프트 삭제된 항목 목록 | `TrashListResponse` |
| `POST` | `/trash/:id/restore` | 복원 | `204` |
| `DELETE` | `/trash/:id` | 영구 삭제 (MinIO + DB 삭제) | `204` |

`/trash/:id`의 `id`는 파일 또는 폴더 ID. 요청 body에 `type: "file" | "folder"` 구분자 포함.

---

## 3. 핵심 비즈니스 로직

### 3.1 파일 업로드 흐름

```
1. multipart 요청 수신
2. busboy로 스트림 파싱 시작 (메모리 버퍼링 없음)
3. folderId 유효성 검증 (소유자 확인)
4. minioKey 생성: {userId}/{uuidv4()}
5. MinIO putObject (request stream → MinIO stream pipe)
6. DB insert (name, minioKey, size, mimeType, folderId, userId)
7. Redis 캐시 무효화 (해당 folderId 키)
8. FileResponse 반환
```

MinIO 업로드 실패 시 DB insert 없이 에러 반환. DB insert 실패 시 MinIO 오브젝트 삭제 후 에러 반환.

### 3.2 폴더 소프트 삭제 cascade

DB `onDelete: 'cascade'`에 의존하지 않고 서비스 레이어에서 처리한다.

```
1. 폴더 ID로 하위 전체 파일·폴더 조회 (CTE 재귀 쿼리)
2. 하위 파일 전체 softDeletedAt = NOW() 일괄 업데이트
3. 하위 폴더 전체 softDeletedAt = NOW() 일괄 업데이트
4. 대상 폴더 softDeletedAt = NOW() 업데이트
5. Redis 캐시 무효화 (부모 폴더 키)
```

### 3.3 파일 이동

```
1. 대상 folderId 소유자 검증 (NULL이면 루트)
2. files.folderId 업데이트
3. Redis 캐시 무효화 (출발 폴더 키 + 도착 폴더 키)
```

### 3.4 파일 복사

```
1. 원본 파일 조회
2. 새 minioKey 생성: {userId}/{uuidv4()}
3. MinIO copyObject (원본 key → 새 key)
4. DB insert (복사된 메타데이터)
5. Redis 캐시 무효화 (도착 폴더 키)
```

### 3.5 영구 삭제 (휴지통에서)

```
1. DB에서 minioKey 조회
2. MinIO removeObject
3. DB delete
```

MinIO 삭제 실패 시 DB는 유지. 운영자가 고아 오브젝트를 수동 정리 가능.

### 3.6 ZIP 다운로드

```
1. fileIds 배열 수신 (최대 100개)
2. 각 파일 소유자 검증
3. archiver 인스턴스 생성 (zip format)
4. 각 파일의 MinIO getObject 스트림을 archiver에 append
5. archiver stream → response stream pipe
```

---

## 4. Redis 캐시 전략

NestJS `@nestjs/cache-manager` + Redis 어댑터. BullMQ와 동일 Redis 인스턴스 공용.

**캐시 키:**
```
루트 목록:    files:user:{userId}:folder:root
폴더 목록:    files:user:{userId}:folder:{folderId}
TTL:         60초 (이벤트 기반 무효화의 안전망)
```

**무효화 트리거:**

| 작업 | 무효화 대상 |
|---|---|
| 파일 업로드 | 대상 폴더 키 |
| 파일 삭제/이름변경 | 현재 폴더 키 |
| 파일 이동 | 출발 폴더 키 + 도착 폴더 키 |
| 폴더 생성/삭제/이름변경 | 부모 폴더 키 |
| 폴더 이동 | 출발 부모 키 + 도착 부모 키 |

**캐시 미적용:** 파일 다운로드 (바이너리 스트림), 검색 결과 (쿼리 조합 다양), 단일 파일 메타데이터

---

## 5. ErrorCode 추가 목록

| 키 | 메시지 | Status |
|---|---|---|
| `FILE_NOT_FOUND` | 파일을 찾을 수 없습니다 | 404 |
| `FOLDER_NOT_FOUND` | 폴더를 찾을 수 없습니다 | 404 |
| `FILE_UPLOAD_FAILED` | 파일 업로드에 실패했습니다 | 500 |
| `FILE_ALREADY_DELETED` | 이미 삭제된 파일입니다 | 409 |
| `FOLDER_ALREADY_DELETED` | 이미 삭제된 폴더입니다 | 409 |
| `INVALID_MOVE_TARGET` | 하위 폴더로 이동할 수 없습니다 | 400 |
| `ZIP_LIMIT_EXCEEDED` | ZIP 다운로드는 최대 100개까지 가능합니다 | 400 |

---

## 6. 모듈 구조

```
src/
  file/
    file.module.ts
    file.controller.ts
    file.service.ts
    file.repository.ts
    file.controller.spec.ts
    file.service.spec.ts
    file.repository.spec.ts
  folder/
    folder.module.ts
    folder.controller.ts
    folder.service.ts
    folder.repository.ts
    folder.controller.spec.ts
    folder.service.spec.ts
    folder.repository.spec.ts
  trash/
    trash.module.ts
    trash.controller.ts
    trash.service.ts
    trash.controller.spec.ts
    trash.service.spec.ts
  database/
    schema/
      files.schema.ts      (신규)
      folders.schema.ts    (신규)
```

**패키지 의존성 추가 (services/api):**
- `busboy` — multipart 스트리밍 파싱
- `minio` 또는 `@aws-sdk/client-s3` — MinIO S3 호환 클라이언트
- `archiver` — ZIP 스트리밍
- `@nestjs/cache-manager` + Redis 어댑터 — 폴더 목록 캐싱

---

## 7. contracts 추가 목록

```
packages/contracts/src/
  contracts/
    file.contract.ts    (신규)
    folder.contract.ts  (신규)
    trash.contract.ts   (신규)
  schemas/
    file.schema.ts      (신규)
    folder.schema.ts    (신규)
    trash.schema.ts     (신규)
```

---

## 8. 미래 확장성 고려

현재 `files.user_id`, `folders.user_id`로 소유권을 직접 관리한다. 향후 iSCSI/SMB 등 다중 스토리지 프로토콜 지원이 필요해지면:

1. `drives` 테이블 추가 (storage 단위, backend 프로토콜 정보 포함)
2. `files.drive_id`, `folders.drive_id` 컬럼 추가
3. 기존 데이터는 사용자별 기본 drive 행으로 backfill
4. `user_id`를 drive를 통한 간접 조회로 전환

Flyway 마이그레이션 1~2회로 처리 가능한 구조다.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-06 | 초기 설계 작성 |

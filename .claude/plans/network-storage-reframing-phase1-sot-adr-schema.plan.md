---
name: network-storage-reframing-phase1-sot-adr-schema
description: Phase 1 — Storage SoT 재정의 ADR(0003, 0004) + drives/mount_credentials/share_grants 스키마 추가 (기존 files/folders 미터치)
status: in-progress
created: 2026-05-27
---

# Plan: Phase 1 — Storage SoT ADR + Schema 설계

## Summary

Phase 0 spike 가 **Go(조건부) — iSCSI 트랙** 으로 종료([report](../../docs/spikes/phase0-steam-network-storage.md))되어 PRD 가설의 기술 타당성이 확인됐다. 이 plan 은 **코드 변경을 동반하지 않는 결정** 두 가지를 ADR 로 박제하고, **신규 entity 3종**(`drives`, `mount_credentials`, `share_grants`) 의 Drizzle 스키마 + 마이그레이션 파일만 추가한다. 기존 `files`/`folders`/`upload_sessions` 는 **이 phase 에서 건드리지 않는다** — 실제 SoT 이전·데이터 마이그레이션은 Phase 5/6 의 책임이며, 본 phase 에선 ADR-0003 본문에서 "deprecation path" 만 명시한다.

## User Story

As **본인 (operator + architect)**,
I want to **Phase 5/6 의 큰 breaking change 전에 ADR 로 결정·근거·trade-off 를 박제하고 신규 storage entity 형상을 합의**,
so that **Phase 2(sidecar) 와 Phase 3(web 발급 UI) 가 동일한 데이터 모델 위에서 병렬 설계될 수 있고, 후속 phase 에서 "왜 이렇게 됐는가" 를 재학습할 필요가 없다**.

## Problem → Solution

**현재 상태**: PRD reframing 이 product 차원에서 합의됐고 Phase 0 spike 가 가설 검증을 끝냈으나, **결정 자체는 어떤 영속 문서에도 기록되지 않은 상태**. 후속 phase 가 시작되면 "왜 SoT 를 옮기는가", "왜 SMB 가 아닌 iSCSI 부터인가", "신규 entity 의 owning side 는 무엇인가" 같은 결정이 PR 리뷰마다 재논쟁될 위험이 있다. 또한 신규 entity 가 schema 에 부재해 Phase 2 sidecar 가 어떤 row 를 생성·갱신할지 합의된 형상이 없다.

**목표 상태**: (a) ADR-0003(Storage SoT 이전) + ADR-0004(iSCSI 우선·SMB 보류) 가 `accepted` 상태로 INDEX.md 에 등재, (b) `drives`/`mount_credentials`/`share_grants` 3개 테이블의 Drizzle 스키마 + 마이그레이션이 `npm run db:generate` 통과·`npm run db:push` 적용 가능, (c) PRD Phase 1 row 가 `in-progress` → `complete` 로 갱신되고 본 plan 경로가 PRP 컬럼에 등재. **기존 files/folders/upload_sessions 코드/스키마는 본 PR diff 에 0줄**.

## Metadata

- **Complexity**: Small/Medium — 코드 변경량은 적으나 ADR 본문(특히 0003) 의 trade-off 서술이 시간 소요. 스키마 3종은 기존 컨벤션 그대로 따라가면 boilerplate 수준.
- **Source PRD**: [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md)
- **PRD Phase**: Phase 1 — Storage SoT 재정의 ADR + schema 설계
- **Estimated Artifacts**: 7 — ADR 2개 + INDEX.md 1개 + Drizzle schema 3개 + 마이그레이션 SQL 1개 (+ schema/index.ts 와 PRD 1줄 갱신)
- **Estimated Duration**: 1~2일 (ADR 본문 1일 + 스키마/마이그레이션 0.5일 + review·수정 0.5일)
- **Parallel with**: Phase 2(privileged storage agent) — schema 형상이 sidecar 계약에 영향을 주므로 PR 머지 전 cross-review 필요

---

## UX Design

N/A — 본 phase 는 사용자 대상 UI 변경이 없는 **내부 설계 활동**. ADR 본문은 향후 Phase 3 web 콘솔 설계 시 "왜 이런 entity 가 있는가" 의 reference 가 된다.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md) §"Proposed Solution", §"Technical Approach", §"Decisions Log" | ADR 본문이 그대로 인용 |
| P0 | [docs/spikes/phase0-steam-network-storage.md](../../docs/spikes/phase0-steam-network-storage.md) §"Decision" | TBD-1·TBD-5 응답을 ADR-0004 근거로 사용 |
| P0 | [docs/adr/0002-twofa-strategy-pattern.md](../../docs/adr/0002-twofa-strategy-pattern.md) | ADR 작성 톤·구성·5섹션 형식의 모범 사례 |
| P0 | [docs/adr/INDEX.md](../../docs/adr/INDEX.md) | 새 ADR 등재 패턴(번호·상태·날짜·링크) |
| P1 | [services/api/src/database/schema/files.schema.ts](../../services/api/src/database/schema/files.schema.ts) + [folders.schema.ts](../../services/api/src/database/schema/folders.schema.ts) + [users.schema.ts](../../services/api/src/database/schema/users.schema.ts) | Drizzle 스키마 컨벤션 (pgTable, defaultRandom UUID, withTimezone timestamp, index/unique 패턴) |
| P1 | [services/api/drizzle/0003_create_files.sql](../../services/api/drizzle/0003_create_files.sql) | 마이그레이션 SQL 출력 포맷 (`statement-breakpoint` 구분자, FK 명명) |
| P1 | [services/api/src/database/schema/index.ts](../../services/api/src/database/schema/index.ts) | 신규 schema re-export 위치 |
| P1 | [services/api/drizzle.config.ts](../../services/api/drizzle.config.ts) | `db:generate` 의 schema/out 경로 |
| P2 | [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"DB 마이그레이션" | `npm run db:generate` / `db:push` 흐름 |
| P2 | [.claude/rules/ecc/nestjs/patterns.md](../../.claude/rules/ecc/nestjs/patterns.md) §"Repository Pattern" + memory `project_repository_pattern` | 신규 entity 가 repository 단계로 갈 때 따를 컨벤션 (Phase 1 범위 외이나 schema 설계에 참고) |
| P2 | memory `project_storage_extensibility` | 미래 멀티 스토리지 확장 — `drives` 도입의 일관된 이유 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Drizzle ORM pg-core | https://orm.drizzle.team/docs/column-types/pg | `t.uuid`, `t.varchar`, `t.bigint`, `t.timestamp({ withTimezone: true })`, `t.index()`, `t.unique()`, `t.check()` 시그니처 |
| Drizzle Kit generate | https://orm.drizzle.team/kit-docs/commands#generate-migrations | `prefix: 'index'` 설정에서 다음 마이그레이션 번호가 어떻게 결정되는지 (현재 0005 다음 = 0006) |
| Michael Nygard ADR | https://github.com/joelparkerhenderson/architecture-decision-record | 5섹션 (Status / Context / Decision / Consequences / References) |
| Synology SAN Manager (참고) | DSM 7 SAN Manager docs | ADR-0004 의 운영 context (실 NAS 가 raw `targetcli` 가 아닌 DSM SAN Manager) — Phase 2 의 sidecar 설계 결정에 영향 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| ADR 형식 | [docs/adr/0002-twofa-strategy-pattern.md](../../docs/adr/0002-twofa-strategy-pattern.md):1-15 | YAML frontmatter (`name`/`description`/`status`/`date`) + `# ADR-NNNN:` 제목 + Status/Context/Decision/Consequences/References 5섹션 + Positive/Negative/Mitigations 3-block |
| ADR INDEX 등재 | [docs/adr/INDEX.md](../../docs/adr/INDEX.md):17-20 | `\| NNNN \| [제목](파일.md) \| accepted \| YYYY-MM-DD \|` 한 줄 추가 |
| Drizzle schema 파일 구조 | [services/api/src/database/schema/files.schema.ts](../../services/api/src/database/schema/files.schema.ts):1-27 | `import * as t from 'drizzle-orm/pg-core'` + `pgTable as table` alias + 컬럼 정의 + index/unique 배열 + `$Insert`/`$Select` 타입 export |
| UUID + timestamp 컨벤션 | [services/api/src/database/schema/users.schema.ts](../../services/api/src/database/schema/users.schema.ts):5-17 | `t.uuid('id').primaryKey().defaultRandom()`, `t.timestamp(..., { withTimezone: true }).notNull().defaultNow()` |
| FK + onDelete | [services/api/src/database/schema/files.schema.ts](../../services/api/src/database/schema/files.schema.ts):10-14 | `.references(() => parent.id, { onDelete: 'cascade' })` — 본 phase 의 drives→users, mount_credentials→drives, share_grants→drives 모두 cascade 적합 |
| 자기참조 FK | [services/api/src/database/schema/folders.schema.ts](../../services/api/src/database/schema/folders.schema.ts):13-15 | `(): AnyPgColumn` 형식 — drives 가 향후 부모-자식 구조를 가진다면 참고 (Phase 1 에선 평면) |
| string literal union 컬럼 | (코드베이스에 직접 사례 없음 — varchar + service 레이어 `@IsIn` 검증) | `t.varchar('protocol', { length: 16 })` + Phase 5 service 에서 `@IsEnum(['ISCSI','SMB'])` |
| index 명명 | drizzle auto: `{table}_{column}_index` — 별도 명명 불필요 | 컴포지트 index 가 필요할 때만 `t.index('explicit_name').on(...)` |
| 마이그레이션 SQL 출력 | [services/api/drizzle/0003_create_files.sql](../../services/api/drizzle/0003_create_files.sql) | `db:generate` 자동 생성. 수동 편집 금지 — schema 수정 후 재생성. 다음 번호 = `0006` |
| schema index re-export | [services/api/src/database/schema/index.ts](../../services/api/src/database/schema/index.ts):1-15 | `export * from './{name}.schema';` 알파벳 순서 유지 |

---

## Files to Create / Update

| File | Action | EOL | Justification |
|---|---|---|---|
| `docs/adr/0003-storage-sot-nas-filesystem.md` | CREATE | CRLF | "Storage SoT 를 PostgreSQL+MinIO 에서 NAS filesystem 으로 이전" — reframing 의 가장 큰 architectural 결정 |
| `docs/adr/0004-iscsi-priority-smb-deferred.md` | CREATE | CRLF | "v1 은 iSCSI 만 통합. SMB 는 evidence 모일 때까지 보류" — Phase 0 spike 결과를 박제 |
| `docs/adr/INDEX.md` | UPDATE | (보존) | 새 ADR 2개 목록 추가 |
| `services/api/src/database/schema/drives.schema.ts` | CREATE | CRLF | 최상위 마운트 단위 entity |
| `services/api/src/database/schema/mount-credentials.schema.ts` | CREATE | CRLF | 사용자별 마운트 자격증명 (iSCSI IQN + Linux/Samba username + secret reference) |
| `services/api/src/database/schema/share-grants.schema.ts` | CREATE | CRLF | drive 레벨 권한 부여 (granteeUserId × accessMode × expiresAt) |
| `services/api/src/database/schema/index.ts` | UPDATE | (보존) | 3개 새 schema re-export |
| `services/api/drizzle/0006_create_storage_entities.sql` | CREATE (drizzle-kit 자동) | LF | `npm run db:generate` 가 자동 출력. 수동 편집 금지 — diff 만 검토 |
| `.claude/prds/network-storage-reframing.prd.md` | UPDATE | (보존) | Phase 1 row status `pending` → `in-progress` (작업 시작 시), 종료 시 `complete` + PRP 컬럼에 본 plan 경로 |

> 본 PR 의 diff 에 `services/api/src/database/schema/files.schema.ts`, `folders.schema.ts`, `upload-sessions.schema.ts`, `services/api/src/file/**`, `services/api/src/folder/**` 가 **단 한 줄도 포함되지 않아야 한다** — Phase 5/6 의 책임이며 본 phase 의 scope creep 신호.

## NOT Building

- **기존 `files`/`folders` 스키마 변경**: deprecation 마킹조차 안 함. ADR-0003 본문에서만 "이 컬럼들의 운명" 을 서술. JSDoc `@deprecated` 도 추가 금지 — 코드 grep 노이즈 + 실제 정리 시점이 Phase 5/6 이라 신호 가치 낮음.
- **데이터 마이그레이션**: Phase 5/6 의 책임. 본 phase 의 마이그레이션은 **신규 테이블 CREATE 만**.
- **Repository / Service / Controller**: 신규 entity 의 NestJS 모듈(`DriveModule`, `MountCredentialModule`, `ShareGrantModule`) 생성 금지. Phase 3+ 의 책임이며 Phase 1 의 schema 가 미리 모듈을 호출하지 않는다.
- **HTTP API / Swagger DTO**: 동일 이유. schema 만 있고 endpoint 는 0개.
- **테스트**: 본 phase 는 코드 로직이 없음 — schema 정의 + 마이그레이션 SQL 만. 단위 테스트 대상 없음. `db:generate` 통과 + `db:push` 적용이 사실상의 검증.
- **sidecar 프로토콜 정의**: ADR-0004 가 "어떤 프로토콜을 우선" 만 결정. agent ↔ NestJS 의 unix socket schema 는 Phase 2 의 책임.
- **multi-tenant 권한 모델 세부**: `share_grants` 의 컬럼 형상만 결정. "어떤 role 이 어떤 drive 를 grant 할 수 있는가" 같은 정책은 Phase 5 의 책임. ADR-0003 에는 "v1.x 에서 확장 여지" 정도만 기재.

---

## Step-by-Step Tasks

### Task 1 — ADR-0003 작성 (Storage SoT 이전)

- **ACTION**: `docs/adr/0003-storage-sot-nas-filesystem.md` 작성. Nygard 5섹션 + Positive/Negative/Mitigations 3-block.
- **MIRROR**: [docs/adr/0002-twofa-strategy-pattern.md](../../docs/adr/0002-twofa-strategy-pattern.md) 의 frontmatter + 섹션 헤더 + 표 사용 패턴
- **CONTENT 가이드**:
  - **Status**: `accepted (PR #?? — 머지 시점에 채움)`. 작성 단계에선 `proposed`, 머지 직전 `accepted` + PR 번호 기입
  - **Context**: PRD 의 "Trigger 사건" + "트레이드오프 분석" 인용. 핵심: HTTP-only 가 가설의 본질(직접 마운트 + Steam) 와 물리적으로 양립 불가
  - **Decision**: SoT 를 NAS filesystem 으로 이전. 신규 3 entity 도입. 기존 `files`/`folders`/`upload_sessions` 는 Phase 5/6 에서 (a) HTTP 전용 metadata 로 축소 또는 (b) 폐기 — 둘 중 결정은 Phase 5/6 의 책임이며 본 ADR 에선 양 선택지를 열어 둠
  - **Consequences — Positive**: 양 채널 동일 view, 게임/프로그램 직접 실행, 동기화 복사본 제거
  - **Consequences — Negative**: HTTP CRUD 의 transactional 일관성(예: rename + permission 갱신) 이 filesystem ↔ DB 양쪽에 분산됨. MinIO 의 versioning 같은 기능을 잃음. backup 책임이 외부 도구(SMB 마운트 + Restic 등) 로 이전됨
  - **Consequences — Mitigations**: filesystem ↔ DB 동기는 별도 sidecar 가 책임(Phase 2 ADR 후보), versioning 은 ZFS snapshot 으로 대체 검토, backup 가이드는 Phase 7 의 문서 산출물
  - **References**: PRD, Phase 0 spike report, ADR-0004 (cross-ref)
- **VALIDATE**:
  - `head -n 5 docs/adr/0003-*.md` → frontmatter `name`/`description`/`status`/`date` 4개 키 존재
  - `grep -E "^## (Status|Context|Decision|Consequences|References)" docs/adr/0003-*.md` → 5개 매치
  - `grep -E "^### (Positive|Negative|Mitigations)" docs/adr/0003-*.md` → 3개 매치
  - 본문에 [Phase 0 spike report](../../docs/spikes/phase0-steam-network-storage.md) 와 [PRD](../prds/network-storage-reframing.prd.md) 링크 모두 존재

### Task 2 — ADR-0004 작성 (iSCSI 우선·SMB 보류)

- **ACTION**: `docs/adr/0004-iscsi-priority-smb-deferred.md` 작성. ADR-0003 와 동일 형식.
- **MIRROR**: ADR-0002 형식 + ADR-0003 와 cross-link
- **CONTENT 가이드**:
  - **Context**: PRD TBD-1 ("SMB vs iSCSI 우선") + Phase 0 spike 결과(iSCSI Track A 만 검증, SMB Track B 건너뜀)
  - **Decision**: v1 은 iSCSI 만 통합. SMB 는 (a) Steam 외 워크로드(가족 모바일 사진 백업, 일반 파일 공유) 가 본격화되거나 (b) iSCSI 마운트가 비-게임 클라이언트(Mac, Linux 데스크톱) 에서 마찰을 일으킬 때 ADR-0005 로 재평가
  - **Consequences — Positive**: 통합 범위 축소 = sidecar 복잡도 절반, 검증된 워크로드 1종(Steam) 위에서 안정화, DSM SAN Manager 의 iSCSI 기능 직접 활용 가능
  - **Consequences — Negative**: Mac/Linux 사용자가 iSCSI Initiator 셋업 마찰. 가족 모바일 백업은 HTTP 채널(기존 File API) 로만 가능(Phase 5/6) — SMB 가 있으면 모바일도 mount 가능했음. 일반 파일 협업(여러 PC 가 동시 read/write) 에는 iSCSI 가 부적합(파일 락 충돌)
  - **Consequences — Mitigations**: SMB 의 명확한 후속 평가 트리거를 본 ADR 에 명시. 가족 모바일은 Phase 6 의 HTTP File API 재포지셔닝으로 커버
  - **References**: PRD TBD-1, Phase 0 spike Decision 섹션, ADR-0003 (cross-ref)
- **VALIDATE**: Task 1 과 동일한 grep 4종 + 본문에 ADR-0003 링크 존재

### Task 3 — ADR INDEX 갱신

- **ACTION**: `docs/adr/INDEX.md` 의 목록 표에 2 row 추가
- **MIRROR**: [docs/adr/INDEX.md](../../docs/adr/INDEX.md):17-20 의 한 줄 형식
- **EXACT EDIT**: 표 끝에 추가
  ```
  | 0003 | [Storage SoT 를 NAS filesystem 으로 이전](0003-storage-sot-nas-filesystem.md) | accepted | 2026-05-27 |
  | 0004 | [v1 은 iSCSI 우선 통합 · SMB 보류](0004-iscsi-priority-smb-deferred.md) | accepted | 2026-05-27 |
  ```
  - `accepted` 는 PR 머지 시점에 최종. 작성 단계에선 `proposed` 로 두고 머지 직전 일괄 변경.
  - 날짜는 작성 시점이 아니라 **accepted 시점** — INDEX 와 ADR frontmatter 의 `date` 가 일치해야 함
- **VALIDATE**: `grep -E "^\| 000[34] \|" docs/adr/INDEX.md` → 2개 매치

### Task 4 — `drives` 스키마 작성

- **ACTION**: `services/api/src/database/schema/drives.schema.ts` 작성
- **MIRROR**: [files.schema.ts](../../services/api/src/database/schema/files.schema.ts) + [folders.schema.ts](../../services/api/src/database/schema/folders.schema.ts)
- **컬럼 형상**:
  - `id` uuid PK defaultRandom
  - `ownerId` uuid NOT NULL → `users.id` ON DELETE CASCADE
  - `name` varchar(100) NOT NULL — drive display name (예: "내 드라이브", "가족 공용")
  - `kind` varchar(16) NOT NULL — `'PRIVATE' | 'SHARED'` (string literal union, service 레이어 `@IsIn` 검증). v1 에선 2종, v1.x 에서 확장 여지
  - `mountPath` varchar(255) NOT NULL UNIQUE — NAS filesystem 실제 경로 (예: `/volume1/drives/{drive_id}`). UNIQUE 로 중복 mount 방지
  - `quotaBytes` bigint NULL — Could in PRD(v1.1). null = 무제한
  - `createdAt`, `updatedAt` timestamp withTimezone notNull defaultNow
- **인덱스**: `index().on(ownerId)`, `index().on(kind)`. `mountPath` 는 unique 가 이미 index 역할
- **타입 export**: `Drives$Insert`, `Drives$Select`
- **VALIDATE**:
  - `npx tsc --noEmit -p services/api/tsconfig.json` 통과
  - `grep -c "from 'drizzle-orm/pg-core'" services/api/src/database/schema/drives.schema.ts` = 1
  - 파일 라인 수 ≤ 35 (기존 schema 들과 동일 규모)

### Task 5 — `mount_credentials` 스키마 작성

- **ACTION**: `services/api/src/database/schema/mount-credentials.schema.ts` 작성
- **MIRROR**: files.schema.ts 형식. multi-FK 패턴은 files (userId + folderId) 와 동일
- **컬럼 형상**:
  - `id` uuid PK defaultRandom
  - `driveId` uuid NOT NULL → `drives.id` ON DELETE CASCADE
  - `userId` uuid NOT NULL → `users.id` ON DELETE CASCADE — 이 자격증명의 소유자(발급 대상)
  - `protocol` varchar(16) NOT NULL — `'ISCSI' | 'SMB'`. v1 에선 ISCSI 만 실제 발급되지만 schema 는 양쪽 지원
  - `osUsername` varchar(64) NOT NULL — NAS 호스트 OS / Samba 계정명 (terab user 와 별개 — 명시적 매핑)
  - `secretRef` varchar(255) NOT NULL — Docker Secret 파일 경로 reference (예: `mount_cred_{id}`). **평문 비밀번호 컬럼 추가 절대 금지** — Secret 은 host /run/secrets/ 에만 존재
  - `iqn` varchar(255) NULL — iSCSI 만 사용. SMB row 는 NULL. (CHECK 제약은 service 레이어 검증 + DB 는 NULL 허용)
  - `lastUsedAt` timestamp withTimezone NULL — 마운트 세션 모니터링용
  - `revokedAt` timestamp withTimezone NULL — soft revoke (audit log 보존)
  - `createdAt`, `updatedAt` 표준
- **인덱스**: `index().on(driveId)`, `index().on(userId)`, `unique().on(driveId, userId, protocol)` — 한 사용자가 한 drive 에 같은 protocol 자격증명 중복 발급 차단
- **타입 export**: `MountCredentials$Insert`, `MountCredentials$Select`
- **VALIDATE**:
  - tsc 통과
  - `grep -E "(password|plaintext|secret_value)" services/api/src/database/schema/mount-credentials.schema.ts` → **0건** (보안 검증)
  - 파일 라인 수 ≤ 50

### Task 6 — `share_grants` 스키마 작성

- **ACTION**: `services/api/src/database/schema/share-grants.schema.ts` 작성
- **MIRROR**: files.schema.ts 형식 + role-permissions.schema.ts 의 join-table 패턴(참고만 — 본 테이블은 grant audit 가 있어 단순 join 아님)
- **컬럼 형상**:
  - `id` uuid PK defaultRandom
  - `driveId` uuid NOT NULL → `drives.id` ON DELETE CASCADE — v1 은 drive-level grant 만. 파일/폴더 단위 grant 는 Phase 5+
  - `granteeUserId` uuid NOT NULL → `users.id` ON DELETE CASCADE — grant 받는 사용자
  - `accessMode` varchar(16) NOT NULL — `'READ' | 'WRITE'`. v1 에선 2종
  - `grantedByUserId` uuid NOT NULL → `users.id` ON DELETE RESTRICT — 누가 grant 했는가. RESTRICT 로 audit 무결성 (grant 한 사용자 삭제 시 grant row 보호)
  - `expiresAt` timestamp withTimezone NULL — null = 무기한
  - `revokedAt` timestamp withTimezone NULL — soft revoke
  - `createdAt` timestamp withTimezone notNull defaultNow (updatedAt 없음 — grant 는 immutable, revoke 만 가능)
- **인덱스**: `index().on(driveId)`, `index().on(granteeUserId)`, `unique().on(driveId, granteeUserId, accessMode)` — 동일 grant 중복 차단. revoke 후 재발급 케이스는 `revokedAt IS NULL` partial index 가 더 정확하나 Drizzle pg-core 의 partial unique 지원이 제한적이라 service 레이어에서 처리
- **타입 export**: `ShareGrants$Insert`, `ShareGrants$Select`
- **VALIDATE**:
  - tsc 통과
  - 파일 라인 수 ≤ 50

### Task 7 — schema index re-export + 마이그레이션 생성

- **ACTION**:
  1. `services/api/src/database/schema/index.ts` 에 3 줄 추가 (알파벳 순서: `drives` 는 `devices` 와 `files` 사이, `mount-credentials` 는 `invitations` 와 `permissions` 사이, `share-grants` 는 `roles` 와 `trusted-devices` 사이)
  2. `cd services/api && npm run db:generate` 실행 — `drizzle/0006_*.sql` 자동 생성
  3. 생성된 SQL 을 **review만** (수정 금지). 다음 검토:
     - 3개 CREATE TABLE 문 존재
     - FK 6개 (drives→users, mount_credentials→drives, mount_credentials→users, share_grants→drives, share_grants→users grantee, share_grants→users grantedBy)
     - UNIQUE 제약 3개 (drives.mount_path, mount_credentials (driveId,userId,protocol), share_grants (driveId,granteeUserId,accessMode))
     - 기존 테이블 ALTER 가 **0건**
- **MIRROR**: [drizzle/0003_create_files.sql](../../services/api/drizzle/0003_create_files.sql) 의 SQL 출력 포맷
- **GOTCHA**: drizzle-kit 이 마이그레이션 번호를 자동 결정 — 현 prefix `index` 기반이라 `0006` 이 다음. 만약 다른 PR 이 같은 번호를 차지하면 충돌. 머지 직전 rebase 후 `npm run db:generate` 재실행 필요
- **VALIDATE**:
  - `npm run db:generate` exit 0
  - `ls services/api/drizzle/000[6-9]*.sql` = 1개 매치
  - `git diff services/api/src/database/schema/files.schema.ts services/api/src/database/schema/folders.schema.ts services/api/src/database/schema/upload-sessions.schema.ts` → **diff 0** (보호 검증)
  - 마이그레이션 SQL 에 `ALTER TABLE "files"`, `ALTER TABLE "folders"`, `ALTER TABLE "upload_sessions"` 0건
  - 로컬에서 `npm run db:push` 적용 후 PostgreSQL 에 3개 테이블 실제 생성 확인 (`psql -c "\dt drives mount_credentials share_grants"`)

### Task 8 — PRD Phase 1 row + INDEX 상태 갱신 + 최종 검토

- **ACTION**:
  1. PRD 의 Implementation Phases 표에서 Phase 1 row 갱신:
     - status: `pending` → `in-progress` (작업 시작 시점) → `complete` (PR 머지 시점)
     - Plan PRP 컬럼: `[phase1-sot-adr-schema](../plans/network-storage-reframing-phase1-sot-adr-schema.plan.md)`
  2. ADR-0003 / ADR-0004 frontmatter `status` 를 `proposed` → `accepted` 로 변경, `date` 를 머지일로 확정
  3. ADR INDEX 의 두 row 도 동일하게 `accepted` + 머지일
- **MIRROR**: 이전 Phase 0 plan 의 PRD 갱신 패턴 ([network-storage-reframing-phase0-spike](network-storage-reframing-phase0-spike.plan.md) Task 6)
- **VALIDATE**:
  - `grep -n "phase1-sot-adr-schema" .claude/prds/network-storage-reframing.prd.md` → 1건 매치
  - `grep -n "in-progress\|complete" .claude/prds/network-storage-reframing.prd.md` 의 Phase 1 row 가 의도한 상태인지 육안 확인
  - 본 plan 자신의 frontmatter `status` 도 동일 단계(머지 시 `done`)로 갱신

---

## Open Decisions (작업 시작 전 합의 필요)

| # | 결정 항목 | 선택지 | 권장 |
|---|---|---|---|
| **D1** | `drives.kind` 의 v1 값 | (a) `'PRIVATE' \| 'SHARED'` 2종, (b) `'PRIVATE' \| 'SHARED' \| 'SYSTEM'` 3종 (관리자 전용), (c) `'PRIVATE'` 1종 + share_grants 로 SHARED 표현 | **(a)** — share_grants 가 read/write 액세스를 표현하지만 "공용 드라이브" 개념은 그것과 직교(top-level 분류). 3종 SYSTEM 은 v1 가족 규모에 과함 |
| **D2** | `mount_credentials.protocol` 의 SMB 컬럼 허용 여부 | (a) v1 은 `'ISCSI'` 만 허용, schema 차원에서 CHECK 제약, (b) `'ISCSI' \| 'SMB'` 모두 허용하되 service 레이어에서 SMB 차단 | **(b)** — schema 마이그레이션 비용을 v1.x 의 SMB 도입 시 다시 치르지 않기 위해. ADR-0004 가 보류한 것은 통합이지 schema 형상이 아님 |
| **D3** | `share_grants.accessMode` 표현 | (a) `'READ' \| 'WRITE'` 2종, (b) 기존 `permissions` 테이블 referencing(`permissionId` FK), (c) bitmask | **(a)** — `permissions` 테이블은 RBAC 의 resource×action 마스터 (전역). drive grant 는 사용자 × drive 의 inheritance — 직교 모델. bitmask 는 PostgreSQL grep 가독성 ↓ |
| **D4** | secret 저장 전략 | (a) 본 PR 에 Docker Secret 등록 스크립트 포함, (b) `secretRef` 컬럼만 추가하고 등록 흐름은 Phase 3 web 콘솔 발급 UI 의 책임 | **(b)** — 본 phase 는 schema only. secret 자동 등록은 sidecar(Phase 2) + 웹 발급(Phase 3) 합동 |
| **D5** | 마이그레이션 적용 시점 | (a) 본 PR 머지와 동시에 운영 NAS 에 `db:push`, (b) 본 PR 은 schema/SQL 만 머지하고 운영 적용은 Phase 5/6 의 데이터 마이그레이션과 함께 | **(a)** — 신규 테이블 CREATE 만이라 기존 데이터 영향 0. 일찍 적용해 Phase 2 sidecar 가 실제 DB 에 row 쓰며 개발 가능 |

---

## Validation Commands

### 스키마 + 마이그레이션 정합성
```bash
cd services/api
npm run db:generate           # exit 0, 0006_*.sql 1개 생성
ls drizzle/0006_*.sql         # 정확히 1개
npx tsc --noEmit              # 타입 오류 0
```
EXPECT: 모두 통과. tsc 가 신규 schema 의 type export 와 기존 코드 사용을 검증.

### 기존 테이블 무변경 보호
```bash
git diff --name-only services/api/src/database/schema/ services/api/src/file/ services/api/src/folder/ \
  | grep -vE "(drives|mount-credentials|share-grants|index)\.(schema\.)?ts$"
```
EXPECT: 출력 0줄. 신규 3 schema + index 갱신 외에는 어떤 파일도 diff 에 등장하지 않음.

### 마이그레이션 SQL 보호
```bash
grep -E "ALTER TABLE \"(files|folders|upload_sessions)\"" services/api/drizzle/0006_*.sql
```
EXPECT: 0건. 신규 테이블만 CREATE.

### ADR 형식 검증
```bash
for f in docs/adr/0003-*.md docs/adr/0004-*.md; do
  echo "=== $f ==="
  head -n 8 "$f"
  grep -E "^## (Status|Context|Decision|Consequences|References)" "$f"
  grep -E "^### (Positive|Negative|Mitigations)" "$f"
done
```
EXPECT: 각 파일마다 frontmatter 4 key + Status/Context/Decision/Consequences/References 5섹션 + Positive/Negative/Mitigations 3 sub-block.

### INDEX 등재 검증
```bash
grep -E "^\| 000[34] \|" docs/adr/INDEX.md
```
EXPECT: 2 row. 상태 `accepted` (머지 시점) + 날짜가 ADR frontmatter `date` 와 일치.

### 보안 검증 (평문 비밀 없음)
```bash
grep -iE "(plaintext|password|secret_value)" services/api/src/database/schema/mount-credentials.schema.ts \
  services/api/drizzle/0006_*.sql
```
EXPECT: 0건. `secretRef` 만 존재 (참조 형식).

### EOL 규칙 (CLAUDE.md)
```bash
file docs/adr/0003-*.md docs/adr/0004-*.md                 # CRLF
file services/api/src/database/schema/*.schema.ts          # CRLF
file services/api/drizzle/0006_*.sql                       # LF (drizzle-kit 출력 그대로)
```

### Manual Validation
- [ ] 로컬 PostgreSQL 에 `npm run db:push` 적용 후 `\dt` 로 3개 신규 테이블 확인
- [ ] ADR-0003 본문이 PRD §"Decisions Log" row 와 일관 (서술이 PRD 보다 ADR 이 더 상세하되 모순 없음)
- [ ] ADR-0004 본문이 Phase 0 spike report §"PRD TBD 응답" 의 TBD-1 결정을 그대로 인용
- [ ] 본 plan 의 frontmatter `status` 가 작업 단계와 일치 (시작 시 `in-progress`, 머지 시 `done`)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 신규 schema 형상이 Phase 2(sidecar) 의 unix socket contract 와 합의되지 않은 채 결정되어, Phase 2 가 시작될 때 컬럼 재설계 필요 | M | M | Phase 1 PR 머지 전 Phase 2 작업자(또는 self) 가 `mount_credentials` 컬럼 (특히 `iqn`, `secretRef`, `osUsername`) 을 cross-review. Phase 1·2 PR 을 같은 milestone 에서 머지 |
| 마이그레이션 번호 충돌 — 다른 PR 이 `0006` 을 먼저 차지 | L | L | 머지 직전 main rebase + `db:generate` 재실행. drizzle-kit 이 자동으로 다음 번호로 옮김 |
| ADR-0003 의 "deprecation path 미결정" 표현이 모호하다고 review reject | M | L | ADR-0003 Decision 섹션에 (a) "HTTP metadata 로 축소" / (b) "전체 폐기" 두 후보를 명시하고 결정 시점을 Phase 5/6 ADR-0005 로 위임. 이 위임 자체가 의도된 결정 |
| `share_grants` 가 grant audit 와 access check 양쪽 책임을 지면서 hot table 이 됨 | L | M | Phase 5 의 service 가 `revokedAt IS NULL` partial index 또는 별도 audit table 분리를 결정. 본 phase 는 forward-compatible 컬럼만 보장 |
| 본 PR 에 `files`/`folders` 코드가 실수로 포함되어 scope creep | L | M | Validation Commands 의 "기존 테이블 무변경 보호" grep 을 PR template 체크리스트에 포함. CI 가 아닌 self-discipline |
| Docker Secret 명명 컨벤션이 secrets/ 디렉토리 정책과 충돌 (`mount_cred_<id>` 가 hookify.protect-secrets-dir 에 걸림) | L | M | ADR-0003 에서 secret 등록 흐름을 sidecar(Phase 2) 의 책임으로 명시. 본 phase 의 `secretRef` 는 reference string 만 — 실제 파일 생성은 sidecar 가 root 권한으로 |
| `accepted` 표기를 PR 머지 전에 commit 해버려 ADR 불변 원칙 위반 | L | L | Task 8 의 순서 — frontmatter `accepted` + 날짜 변경은 머지 직전 마지막 commit 으로만. PR 작성 단계 commit 은 `proposed` |

---

## Acceptance Criteria

- [ ] ADR-0003 (Storage SoT) 가 `docs/adr/0003-storage-sot-nas-filesystem.md` 에 5섹션 + 3 sub-block 형식으로 작성됨
- [ ] ADR-0004 (iSCSI 우선·SMB 보류) 가 `docs/adr/0004-iscsi-priority-smb-deferred.md` 에 동일 형식으로 작성됨
- [ ] `docs/adr/INDEX.md` 에 두 ADR 이 `accepted` 상태로 등재
- [ ] `drives.schema.ts`, `mount-credentials.schema.ts`, `share-grants.schema.ts` 3개 파일이 기존 컨벤션을 따라 작성
- [ ] `services/api/src/database/schema/index.ts` 에 3개 re-export 추가 (알파벳 순서)
- [ ] `npm run db:generate` 가 `drizzle/0006_*.sql` 1개를 자동 생성
- [ ] 마이그레이션 SQL 에 기존 테이블 ALTER 0건
- [ ] `npm run db:push` 로 로컬 PostgreSQL 에 3개 테이블 적용 가능
- [ ] 본 PR diff 에 `files.schema.ts`, `folders.schema.ts`, `upload-sessions.schema.ts`, `src/file/**`, `src/folder/**` 변경 0줄
- [ ] PRD Phase 1 row 가 `complete` + Plan PRP 컬럼에 본 plan 경로 등재
- [ ] 본 plan frontmatter `status` 가 `done`

## Completion Checklist

- [ ] 평문 secret/password 컬럼 0건 — `mount_credentials` 는 `secretRef` 만
- [ ] EOL 규칙 준수: ADR/schema = CRLF, 마이그레이션 SQL = LF
- [ ] ADR `status` 와 INDEX 의 상태가 일치 (`accepted` + 동일 날짜)
- [ ] Open Decisions D1~D5 가 ADR 본문 또는 plan diff 에 결정 결과 반영
- [ ] Phase 2 작업자와 schema 컬럼 cross-review 완료 (특히 `mount_credentials`)
- [ ] PR 머지 직전 main rebase + `db:generate` 재실행으로 마이그레이션 번호 충돌 확인

## Notes

- 본 plan 은 **`/ecc:prp-implement` 의 TDD validation loop 가 적용되지 않는 plan** — 코드 로직이 아니라 schema 정의 + 결정 문서이기 때문. validation 은 "타입 통과 + 마이그레이션 생성 통과 + ADR 형식 통과" 의 정적 검증으로 대체.
- 본 plan 머지 직후 Phase 2 plan (`/ecc:plan` 으로 별도 호출) 을 시작 가능. Phase 2 의 sidecar 가 본 phase 의 schema 위에서 row 를 쓰는 첫 코드. Phase 2 의 cross-review 가 본 phase 의 schema 결정에 대한 사실상의 first user 검증.
- ADR-0003 의 "deprecation path 미결정" 은 약점이 아니라 **의도된 위임** — Phase 5/6 의 실제 데이터·코드 변경 시점에 더 많은 정보(실 트래픽 패턴, 모바일 채널 사용량) 를 갖고 결정해야 합리적. 본 phase 에서 미리 결정하면 가설 기반 over-commit.
- 본 plan 자체가 Phase 1 의 첫 산출물 — `/ecc:prp-implement` 호출 없이 직접 Task 1~8 을 순서대로 진행. ECC 표준은 TDD loop 가정이나 본 phase 는 그 형식에 부적합.

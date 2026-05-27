# PR Review: #51 — feat: Phase 1 Storage SoT ADR(0003,0004) + drives/mount_credentials/share_grants 스키마

**Reviewed**: 2026-05-27
**Author**: idenn207 (박동민)
**Branch**: `feat/storage-foundation` → `v0.1`
**Decision**: REQUEST CHANGES
**URL**: https://github.com/idenn207/terab/pull/51

## Summary

ADR 2종 + Drizzle schema 3종(`drives` / `mount_credentials` / `share_grants`) + 마이그레이션 0006 만 추가하는 매우 잘 보호된 PR. PR body의 "8 level 정적 검증" 주장(보호 파일 diff 0, 보호 테이블 ALTER 0, 평문 비밀 컬럼 0)은 모두 실측으로 확인됨. ADR은 5섹션 + Positive/Negative/Mitigations 구조를 충실히 따랐고 trade-off 양면 기록도 우수.

다만 **schema 차원의 type-safety가 service 레이어에 100% 위임된 상태** (`kind`/`protocol`/`accessMode`가 모두 `varchar(16)` — pgEnum/CHECK 부재) 와 **ADR-0004가 명시한 "SMB row 는 `iqn = null`" 의도가 schema에 표현되지 않은 mismatch**가 핵심 risk. 한 번 머지되면 enum/check 도입은 별도 migration 비용이 들기 때문에 PR 머지 전 보강을 권장.

## Findings

### CRITICAL

None.

- 보안 hardcoded secret/credential 0건 — `mountCredentials.secretRef`는 Docker Secret **파일 reference**만 담는 컬럼이며 평문 secret 컬럼은 schema에 존재하지 않음
- SQL injection 표면 없음 (정적 schema 정의 only, 동적 query 빌더 부재)
- 보호 파일(`files.schema`, `folders.schema`, `upload-sessions.schema`, `src/file/**`, `src/folder/**`) PR diff path에 0회 등장 — Phase 5/6 scope 보호 정확

### HIGH

**HIGH-1: `kind` / `protocol` / `accessMode` 컬럼이 `varchar(16)` — DB 레벨 타입 안전성 부재**

- 위치:
  - [services/api/src/database/schema/drives.schema.ts:14](services/api/src/database/schema/drives.schema.ts#L14) — `kind`
  - [services/api/src/database/schema/mount-credentials.schema.ts:14](services/api/src/database/schema/mount-credentials.schema.ts#L14) — `protocol`
  - [services/api/src/database/schema/share-grants.schema.ts:13](services/api/src/database/schema/share-grants.schema.ts#L13) — `accessMode`
  - [services/api/drizzle/0006_dashing_hiroim.sql](services/api/drizzle/0006_dashing_hiroim.sql) (CREATE TABLE 3종)

- 영향: ADR-0003 D1/D2/D3가 명시한 enum 값(`'PRIVATE' \| 'SHARED'`, `'ISCSI' \| 'SMB'`, `'READ' \| 'WRITE'`)이 schema/DB 레벨에선 보호되지 않음. service 레이어의 `@IsEnum` 검증이 누락·우회되거나, 시드 스크립트·`db:push` 이후 `psql` 직접 접근·향후 추가 client에서 `kind = 'WRONG_VALUE'` 같은 임의 문자열이 들어가도 DB가 거부할 수 없음. 특히 ADR-0004가 명시한 *"Service 레이어가 SMB row 생성을 `@IsEnum(['ISCSI'])` 검증으로 차단"* 은 본 PR scope 외 (Phase 2 책임) 라 본 PR 단계에선 `protocol = 'SMB'` row 차단이 아무 데서도 보장되지 않음.

- 권장 수정 (택1):
  1. **Drizzle pgEnum 도입** (권장 — schema 형상 변경 비용을 v1 초기에 한 번에 흡수):
     ```ts
     import { pgEnum } from 'drizzle-orm/pg-core';

     export const driveKindEnum = pgEnum('drive_kind', ['PRIVATE', 'SHARED']);
     // ...
     kind: driveKindEnum('kind').notNull(),
     ```
     ADR-0003 D1/D2/D3에 "schema 레벨 enum + service 레벨 validator 이중 보호" 문구 추가.
  2. **명시적 위임 박제**: 본 PR scope를 유지하려면 ADR-0003 D1/D2/D3 본문에 *"schema 형상은 `varchar(16)`로 유지하고 enum 보장은 service 레이어에만 의존한다 — `db:push` 이후 운영자가 `psql`로 직접 row 생성하지 않는 것이 운영 가정"* 을 trade-off로 명시 기록. 그렇지 않으면 ADR이 보장한다고 읽히는 enum이 실은 보장 안 됨.

**HIGH-2: `protocol = 'ISCSI'` 일 때 `iqn NOT NULL` cross-column constraint 부재 — ADR-0004 의도와 schema mismatch**

- 위치: [services/api/src/database/schema/mount-credentials.schema.ts:23](services/api/src/database/schema/mount-credentials.schema.ts#L23) (`iqn varchar(255)` nullable)
- 분석: ADR-0004 Mitigations 마지막 항이 명시 *"`mount_credentials.protocol` enum 이 이미 SMB 를 포함하고 `iqn` 컬럼이 nullable 이므로 (SMB row 는 `iqn = null`), v1.x SMB 도입 시 schema 변경 없음"*. 즉 `iqn`은 SMB row 를 위해 nullable. 그러나 schema/DB 레벨엔 **"`protocol = 'ISCSI'` 이면 `iqn` NOT NULL"** 의 보장이 전혀 없음. ISCSI row 도 `iqn = NULL` 로 저장 가능 → sidecar 가 iqn 없이 발급 시도해 silent 마운트 실패.

- 권장 수정:
  ```ts
  import { sql } from 'drizzle-orm';
  // ...
  (table) => [
    t.index().on(table.driveId),
    t.index().on(table.userId),
    t.unique().on(table.driveId, table.userId, table.protocol),
    t.check('iscsi_requires_iqn', sql`protocol != 'ISCSI' OR iqn IS NOT NULL`),
  ],
  ```
  migration 0006_dashing_hiroim.sql 에는 자동 생성되는 `ALTER TABLE "mount_credentials" ADD CONSTRAINT "iscsi_requires_iqn" CHECK ...` 한 줄이 추가됨.

### MEDIUM

**MEDIUM-1: `share_grants` self-grant 방지 CHECK constraint 부재**

- 위치: [services/api/src/database/schema/share-grants.schema.ts](services/api/src/database/schema/share-grants.schema.ts) (`granteeUserId`, `grantedByUserId`)
- 영향: `granteeUserId === grantedByUserId` row 가 DB 레벨에서 거부되지 않음. 자기 자신에게 자기가 권한을 부여하는 무의미한 row → audit log 노이즈 + service 레이어 검증 누락 시 silent
- 권장: `CHECK (grantee_user_id != granted_by_user_id)` 또는 service 레이어에서 명시 + ADR에 결정 박제

**MEDIUM-2: `share_grants.expiresAt > createdAt` 검증 부재**

- 위치: [services/api/src/database/schema/share-grants.schema.ts:23](services/api/src/database/schema/share-grants.schema.ts#L23) (`expiresAt`)
- 영향: 과거 시점 `expiresAt`으로 grant 생성 → 즉시 만료된 dead grant. service 검증이 빠지면 silent
- 권장: service 레벨 검증 + (선택) CHECK `(expires_at IS NULL OR expires_at > created_at)`

**MEDIUM-3: `granteeUserId` 의 `ON DELETE CASCADE` vs grant immutability 일관성**

- 위치: [services/api/src/database/schema/share-grants.schema.ts:17](services/api/src/database/schema/share-grants.schema.ts#L17)
- 분석: PR body가 *"grant 는 immutable, `revokedAt` 으로만 무효화"* 라고 명시했고 `grantedByUserId`는 `ON DELETE RESTRICT`로 audit 무결성을 보호. 그러나 `granteeUserId`는 `CASCADE` — 사용자 삭제 시 grant row 자체가 사라짐. immutability 정책과 trade-off 결정이 ADR에 명시되지 않음.
- 권장: 두 가지 중 결정 후 ADR-0003 D3 부근에 박제
  - (a) `granteeUserId`도 `RESTRICT` — 사용자 삭제 전 grant 명시적 revoke 강제 (audit 완전 보존)
  - (b) 현 `CASCADE` 유지 + *"사용자 삭제 = grant 자동 폐기, `grantedByUserId` rows 로 grantor 측 audit 충분"* 결정 박제

**MEDIUM-4: `share_grants.unique(driveId, granteeUserId, accessMode)` 와 `revokedAt` 의 상호작용 미정의**

- 위치: [services/api/src/database/schema/share-grants.schema.ts:30](services/api/src/database/schema/share-grants.schema.ts#L30)
- 분석: revoke 된 row 도 unique 제약을 차지 → 같은 drive×grantee×accessMode 로 재발급 시 unique violation. 의도된 동작인지 명시 없음
- 권장 (택1):
  - (a) **Partial unique index** — `UNIQUE (drive_id, grantee_user_id, access_mode) WHERE revoked_at IS NULL` (Drizzle은 `t.uniqueIndex().on(...).where(sql\`revoked_at IS NULL\`)` 형식 지원). 추천.
  - (b) 현 unique 유지 + service 레이어에서 "revoke 후 재발급 = `UPDATE revoked_at = NULL`" 정책 박제

### LOW

**LOW-1: ADR-0003/0004 의 `status: proposed` → 머지 직전 일괄 갱신이 인간 의존 task**

- PR body의 ⚠️ 표가 머지 직전 액션으로 ADR/INDEX/PRD/plan 5항목 일괄 갱신을 요구. 실수 시 ADR이 영구히 `proposed` 상태로 머지될 위험. ADR 불변성 원칙 의도는 정확하나 자동화 부재.
- 권장: 본 PR body의 ⚠️ 항목을 PR template merge checklist 로 항상 표면화하거나, 운영자가 머지 직전 별도 commit 으로 일괄 처리하는 절차를 routine 화

**LOW-2: ADR References 의 Phase 2 sidecar plan 경로가 worktree untracked**

- 위치: ADR-0003 References, ADR-0004 References — `.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md` 링크
- 분석: PR body가 명시 *"Phase 2 plan 은 worktree 에 untracked"*. ADR 머지 후 Phase 2 PR 머지 전까지 broken link 상태로 일정 기간 존재
- 권장: Phase 2 plan 을 본 PR 머지 이전 또는 동시 머지, 또는 ADR References 행을 *"Phase 2 plan — 추후 PR에서 추가"* 로 변경

**LOW-3: ADR-0004 D3 의 "Service 레이어 `@IsEnum(['ISCSI'])` 차단" 의 후속 보장 미박제**

- ADR-0004는 schema 의 SMB 허용 + service 레이어 차단 이중 정책을 명시하지만, 본 PR 단계엔 service 레이어가 존재하지 않음. Phase 2 sidecar PR이 이 검증을 빠뜨리면 DB에 SMB row 생성 가능
- 권장: Phase 2 plan acceptance criteria 에 *"`mount_credentials.protocol` 값이 `'ISCSI'` 만 허용하는 service 레이어 `@IsEnum` 검증 추가"* 한 줄 박제 (본 PR scope 외, Phase 2 PR 의 review item)

**LOW-4: varchar 길이 제한의 결정 근거 부재**

- `drives.name varchar(100)`, `osUsername varchar(64)`, `iqn varchar(255)`, `secretRef varchar(255)` 등 한계 정당성이 ADR/plan 어디에도 없음. 운영 시 한계에 부딪힐 경우 `ALTER TABLE ... ALTER COLUMN ... TYPE varchar(N)` migration 비용
- 권장: 후속 grooming 시 ADR-0003 또는 schema 주석에 결정 근거 한 줄 (예: *"`osUsername varchar(64)` — POSIX 일반 32자 한계 + Samba `idmap` 의 확장 케이스 흡수"*). 본 PR scope 빠듯하므로 즉시 차단 사유 아님

**LOW-5: `Drives$Insert` / `Drives$Select` 등의 타입 별칭 네이밍**

- 위치: 모든 schema 파일 마지막 줄
- 분석: `Drives$Insert` / `MountCredentials$Insert` / `ShareGrants$Insert` 패턴은 본 PR이 처음 도입한 것이 아니라 기존 [users.schema.ts](services/api/src/database/schema/users.schema.ts) 의 `Users$Insert` 패턴과 일치 → 프로젝트 컨벤션 OK. 단, 단수형 entity (`User`, `Drive`, `MountCredential`) 가 더 일반적인 TypeScript 컨벤션이며 `Drives$Insert` 는 "복수형 + dollar separator" 라는 특이 조합. 후속 컨벤션 grooming 후보지만 본 PR이 깰 것은 아님.

**LOW-6: schema 의 `updatedAt` UPDATE 트리거 부재**

- 위치: `drives.schema.ts`, `mount-credentials.schema.ts` — `updatedAt` 컬럼이 `defaultNow()` 만 있고 UPDATE 시 자동 갱신되는 트리거 없음
- 분석: 기존 [users.schema.ts](services/api/src/database/schema/users.schema.ts) 도 동일 패턴 — 프로젝트 전체 컨벤션이므로 본 PR 단독 결함 아님. service 레이어에서 매 UPDATE 시 `updatedAt: new Date()` 를 명시하는 정책으로 보임 (확인 필요)
- 권장: 별도 PR 에서 프로젝트 전체에 `moddatetime` extension trigger 또는 service 레이어 mixin 으로 일괄 처리 — 본 PR scope 외

## Validation Results

| Check | Result | Notes |
|---|---|---|
| 보호 파일 diff = 0 | ✅ Pass | `gh pr diff 51` 의 diff header 12개 모두 신규/메타 파일. `files.schema` / `folders.schema` / `upload-sessions.schema` / `src/file/**` / `src/folder/**` / `src/upload-session/**` 의 변경 0건 |
| 보호 테이블 ALTER = 0 | ✅ Pass | `0006_dashing_hiroim.sql` 에 `ALTER TABLE "files"\|"folders"\|"upload_sessions"` 0건 |
| 평문 secret 컬럼 = 0 | ✅ Pass | `mount_credentials.secretRef` (파일 reference 형식) 외 password / api_key / token_value 컬럼 부재 |
| ADR 형식 (frontmatter 4 key + 5 섹션 + Positive/Negative/Mitigations) | ✅ Pass | ADR-0003 / ADR-0004 모두 충족 |
| ADR INDEX 등재 | ✅ Pass | INDEX.md 에 2 row 추가 (0003, 0004) |
| Drizzle schema → SQL 정합 | ✅ Pass | 3 CREATE TABLE / 6 FK / 3 UNIQUE / 6 INDEX 일치 |
| `index.ts` re-export 알파벳순 정합 | ✅ Pass | drives / mount-credentials / share-grants 3종 알파벳 위치에 정확히 삽입 |
| Type check (`tsc --noEmit`) | ⏭ Skipped | PR head 브랜치이며 schema 파일이 단순 column definition only (24-35줄). PR body가 명시한 8 level 정적 검증의 `tsc 에러 0건` 결과를 신뢰 |
| Lint | ⏭ Skipped | cross-branch |
| Unit tests | ⏭ N/A | PR body 명시 *"schema 정의 + ADR 문서만이라 단위 테스트 대상 없음"* — 정확. 본 PR 단계에선 정적 검증으로 대체 |
| Build | ⏭ Skipped | cross-branch |
| Mergeable | ✅ Pass | `mergeStateStatus: CLEAN`, conflict 없음 |
| CI status | ➖ N/A | `statusCheckRollup: []` — 본 repo 는 PR CI 미설정 (별도 issue) |

## Files Reviewed

| 파일 | Action | 검토 깊이 |
|---|---|---|
| [services/api/src/database/schema/drives.schema.ts](services/api/src/database/schema/drives.schema.ts) | Added | 전체 (24줄) |
| [services/api/src/database/schema/mount-credentials.schema.ts](services/api/src/database/schema/mount-credentials.schema.ts) | Added | 전체 (35줄) |
| [services/api/src/database/schema/share-grants.schema.ts](services/api/src/database/schema/share-grants.schema.ts) | Added | 전체 (35줄) |
| [services/api/src/database/schema/index.ts](services/api/src/database/schema/index.ts) | Modified | 전체 (re-export 3 라인 추가 확인) |
| [services/api/drizzle/0006_dashing_hiroim.sql](services/api/drizzle/0006_dashing_hiroim.sql) | Added | 전체 (51줄) |
| [docs/adr/0003-storage-sot-nas-filesystem.md](docs/adr/0003-storage-sot-nas-filesystem.md) | Added | 전체 (117줄) |
| [docs/adr/0004-iscsi-priority-smb-deferred.md](docs/adr/0004-iscsi-priority-smb-deferred.md) | Added | 전체 (92줄) |
| [docs/adr/INDEX.md](docs/adr/INDEX.md) | Modified | 변경 2 row 확인 |
| services/api/drizzle/meta/0006_snapshot.json | Added (drizzle-kit auto) | 헤더 / FK count 만 검증 (1924 line 자동생성) |
| services/api/drizzle/meta/_journal.json | Modified (drizzle-kit auto) | journal entry 1개 추가 검증 |
| .claude/prds/network-storage-reframing.prd.md | Modified | Phase 1 row 상태 변경 확인 |
| .claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md | Added | 본 PR 의 self-plan — review scope 외 |

## Decision Rationale

**REQUEST CHANGES** 권장 — HIGH-2 (ADR-0004 의 `iqn nullable` 의도와 schema 사이의 mismatch) 가 한 줄 CHECK constraint 추가로 본 PR 안에서 해결 가능하기 때문. HIGH-1 (enum 부재) 은 ADR-0003 D2의 명시적 trade-off로 박제 가능하나, **현 ADR 본문은 "service 레이어 검증이 보장한다"고 읽힐 뿐 schema 가 무방어임을 명시하지 않음** — 본 PR 안에서 ADR 한 줄 추가 또는 pgEnum 도입 중 하나로 mismatch 해소 권장.

작성자가 본인이며 단독 운영 환경이고 PR body의 *"ADR 불변 원칙 위반 회피"* 의도가 명확하므로, 강하게 BLOCK 하지 않고 *REQUEST CHANGES* 로 표면화 — 본인이 의도적 위임으로 ADR 갱신 commit 1회로 닫아도 충분.

## Recommended Next Steps

1. **HIGH-2 해소** (택1):
   - mount-credentials.schema.ts 에 `t.check('iscsi_requires_iqn', sql\`protocol != 'ISCSI' OR iqn IS NOT NULL\`)` 추가 + `npm run db:generate` 로 `0007_*.sql` 자동 생성 후 본 PR 에 squash
   - 또는 ADR-0004 Mitigations 마지막 항을 *"`iqn` cross-column 보장은 Phase 2 sidecar 의 service 레이어 책임"* 으로 명시 박제

2. **HIGH-1 표면화** (택1):
   - 3 schema 에 Drizzle `pgEnum` 도입 + ADR-0003 D1/D2/D3 본문에 "schema + service 이중 보호" 명시
   - 또는 ADR-0003 D1/D2/D3 본문에 *"schema 형상은 `varchar(16)` 유지, enum 보장은 service 레이어 단독 책임 — `psql` 직접 row 생성은 운영 가정 외"* 박제

3. **MEDIUM-1 ~ MEDIUM-4** — Phase 2/3 의 service 레이어 PR review item 으로 backlog 등재 (본 PR 즉시 차단 사유 아님)

4. **머지 직전 액션 자동화 검토 (LOW-1)** — PR template 의 머지 checklist 화 또는 routine 화

머지 직전 본 PR body 의 ⚠️ 표 5항목 (ADR 0003/0004 status, INDEX 두 row, PRD Phase 1 row, plan status) 잊지 말 것.

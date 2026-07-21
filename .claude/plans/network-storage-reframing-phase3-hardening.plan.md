---
name: network-storage-reframing-phase3-hardening
description: Phase 3 mount-credential 의 Codex gate 미해결 결함 6건 + Task 9 manual smoke 완료
status: pending
created: 2026-07-22
---

# Phase 3 hardening — mount-credential 미해결 결함 정리

## Summary

network-storage-reframing Phase 3 의 발급/회수 기능은 v0.1 에 안착했으나, Codex adversarial gate 가 찾은 결함 6건이 미해결로 남아 있다. 그중 **P-1 은 회수 후 재발급을 완전히 막는 CRITICAL** 이고 코드 증거까지 확보된 상태다. 본 plan 은 그 6건을 우선순위대로 처리하고 Task 9 manual smoke 를 완료해 Phase 3 를 종료한다.

## 현재 상태 (2026-07-22 기준)

| PR | 내용 | 상태 |
|---|---|---|
| #76 | API — drive 조회 + mount-credential 발급/회수/목록 (Task 1~5 + e2e) | 머지됨 |
| #78 | Web — entity/feature/widget 슬라이스 (Task 6~8) | 머지됨 |
| #80 | Web — 발급 다이얼로그 미표시(CRITICAL) 외 4건 수정 + flaky 테스트 제거 | 머지됨 (`e67e42c`) |

**남은 것**: 본 plan 의 Task 1~5 + Task 9 manual smoke.

선행 plan: [network-storage-reframing-phase3-self-issuance-ui.plan.md](network-storage-reframing-phase3-self-issuance-ui.plan.md) — 특히 §"Codex gate 결과" 섹션에 발견 17건 전체와 처리 내역이 있다.

Receipt: `.claude/receipts/mccp-{plan,implement}-codex/storage-phase3-web.json` (gitignore 대상, 로컬만). verdict 는 각각 `critical` / `divergent` 로 미수렴 기록됨.

## Mandatory Reading

| 우선 | 문서 | 이유 |
|---|---|---|
| P0 | [phase3-self-issuance-ui.plan.md](network-storage-reframing-phase3-self-issuance-ui.plan.md) §"Codex gate 결과" | 본 plan 의 모든 Task 가 여기서 파생 |
| P0 | `services/api/src/database/schema/mount-credentials.schema.ts` | Task 1 이 직접 수정 |
| P0 | `services/api/src/mount-credential/mount-credential.{service,repository}.ts` | Task 1·2 대상 |
| P1 | [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"오류 추가 절차" · §"DB 마이그레이션" | ErrorCode 추가 + drizzle 절차 |
| P1 | [.claude/rules/ecc/common/logging.md](../rules/ecc/common/logging.md) §"Never Log" | Task 3 의 판단 기준 |

## 확정 결함 — P-1 (CRITICAL, 코드 증거 확보)

**증상**: 자격증명을 회수한 뒤 같은 drive 로 재발급하면 Postgres unique violation(23505)이 발생한다. `ApiException` 이 아니라 처리되지 않은 DB 오류라 500 으로 나간다.

**원인**: 애플리케이션과 DB 가 "중복"의 정의를 다르게 본다.

```ts
// services/api/src/database/schema/mount-credentials.schema.ts:30
t.unique().on(table.driveId, table.userId, table.protocol),   // revokedAt 조건 없음
```

```ts
// mount-credential.repository.ts:59 — 회수는 soft revoke, 행이 남는다
async softRevoke(id: string, now: Date): Promise<void> {
  ... .set({ revokedAt: now, updatedAt: now })
}

// mount-credential.repository.ts:25 — 중복 검사는 active 만 본다
async findActiveByDriveAndProtocol(...) {
  ... isNull(mountCredentials.revokedAt)
}
```

회수 후 `findActiveByDriveAndProtocol` 은 `null` 을 반환해 서비스가 INSERT 로 진행하지만, DB 제약은 revoked 행까지 포함해 판정하므로 위반한다.

**영향**: 1회용 password 를 분실한 사용자의 유일한 복구 경로가 "회수 후 재발급" 인데, 그 경로가 막혀 있다. 즉 password 분실 = drive 마운트 영구 불가.

**제약 출처**: `services/api/drizzle/0006_dashing_hiroim.sql:25`
```sql
CONSTRAINT "mount_credentials_drive_id_user_id_protocol_unique" UNIQUE("drive_id","user_id","protocol")
```

## Step-by-Step Tasks

### Task 1 — P-1: unique 제약을 partial index 로 교체 (CRITICAL)

DB 제약을 애플리케이션 의미(`active 인 것만 중복`)와 일치시킨다.

1. **RED** — `mount-credential.repository.spec.ts` 에 "회수 후 같은 drive/protocol 재발급이 성공한다" 케이스 추가. 현재 스키마에서 실패해야 한다
2. 스키마 수정:
   ```ts
   // t.unique().on(...) 제거하고
   t.uniqueIndex('mount_credentials_active_unique')
     .on(table.driveId, table.userId, table.protocol)
     .where(sql`${table.revokedAt} IS NULL`),
   ```
3. `npm run db:generate` → 생성된 SQL 이 (a) 기존 CONSTRAINT DROP (b) partial UNIQUE INDEX CREATE 2단계인지 육안 확인
4. **주의** — 마이그레이션 적용 전 기존 데이터에 `(drive_id,user_id,protocol)` 이 같은 active 행이 2개 이상이면 index 생성이 실패한다. 실제로는 기존 제약 때문에 불가능하지만, 마이그레이션 SQL 에 방어적 확인 쿼리를 주석으로 남긴다
5. **GREEN** — 1의 테스트 통과 확인

> partial unique index 는 Postgres 의 `CREATE UNIQUE INDEX ... WHERE` 로, revoked 행은 제약 대상에서 빠진다. 같은 drive 에 회수 이력이 몇 개 쌓여도 active 는 항상 1개로 유지된다.

### Task 2 — P-1 후속: 재발급 경로의 e2e 보강

`services/api/test/mount-credential.e2e-spec.ts` 에 round-trip 케이스 추가.

- 발급 → 회수 → **재발급 성공** → 목록에 active 1건만
- 발급 → (회수 없이) 재발급 → `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL`

두 케이스가 함께 있어야 "중복 판정이 active 기준" 이라는 계약이 고정된다.

### Task 3 — P-4: nested error 의 secret 누출 차단 (HIGH)

storage-agent 호출이 실패하면 AxiosError 가 `config.data.osPassword` 를 품은 채 로그 transport 로 직렬화될 수 있다. 기존 검증 `grep logger.*password` 는 직접 인자만 잡아 이 경로를 놓친다.

1. **RED** — agent 호출을 강제 실패시키고 로그 출력에 password 문자열이 없는지 단언하는 테스트
2. pino redact 경로 추가 (`config.data.osPassword`, `config.data.password`, `response.config.data` 등) 또는 agent client 에서 error 를 도메인 오류로 변환하며 원본 config 를 버림
3. 검증 grep 을 nested 경로까지 보도록 갱신 — 선행 plan 의 Validation Commands §"보안 — 평문 secret 누출 없음" 수정

> [logging.md](../rules/ecc/common/logging.md) §"Never Log" 가 1차 출처. "전체 request 객체 로깅 금지 — 필요한 필드만 whitelist" 원칙을 여기에 적용한다.

### Task 4 — P-9: codegen `iqn` 타입 drift 정정 (MEDIUM)

현재 `IssueMountCredentialResponseDto.iqn` 이 codegen 에서 `{[key: string]: unknown} | null` 로 나와, Web 이 `formatIqn(unknown)` 으로 우회 중이다. 실 wire-format 은 `string | null`.

1. API DTO 에 명시: `@ApiProperty({ type: String, nullable: true })`
   > [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"Response DTO의 UUID / ENUM 표현" — nullable union 은 `type` 명시가 없으면 plugin 이 `Object` 로 fallback 한다. 이 결함의 정확한 원인
2. dev 서버 reload 후 `npm --prefix services/web run openapi:codegen`
3. `iqn: string | null` 로 생성되는지 확인
4. Web 의 `formatIqn` 우회 제거 — `DriveMountPanel.tsx`, `IssueMountCredentialButton.tsx` 2곳
5. 테스트의 `as unknown as` cast 도 함께 제거 (`IssueMountCredentialButton.test.tsx:36`)

### Task 5 — 설계 결정 3건 (문서 작업, 코드 변경 없음)

아래 3건은 즉시 수정 가능한 버그가 아니라 **설계 결정이 필요한 항목**이다. 선행 plan 의 Risks 표에 등재하고, 각각 채택/기각을 명시한다.

| # | 항목 | 결정해야 할 것 |
|---|---|---|
| P-2 | 1회용 비밀의 실제 노출면 — Network panel / heap snapshot / XSS | 어디까지를 위협 모델에 넣을지. XSS 를 가정하면 어떤 대응도 무의미하므로 CSP 강화로 방향을 옮길지 |
| P-3 | `.ps1` 이 Downloads/OneDrive/백업에 평문 password 로 장기 잔존 | (a) 파일에 "사용 후 삭제" 경고 주석 + UI 안내, (b) 서버 다운로드 endpoint + `Cache-Control: no-store`, (c) 현행 유지 중 택1. P-10 과 함께 결정 |
| I-4 | 발급 in-flight 중 unmount 시 credential 은 생성되나 비밀 표시 경로 소실 | 서버측 발급 확인 ack 도입 여부. 미도입 시 "확인 못 한 credential 은 사용자가 회수 후 재발급" 이 공식 복구 경로 — Task 1 이 전제조건 |

P-3 결정이 (b)로 가면 P-10(문서 내 `.ps1` 전달 방식 충돌)도 함께 해소된다.

## Task 9 — manual smoke (본인 NAS)

**선행 조건**: `api.env` 에 Phase 3 env 4종이 반영되어 있어야 한다.

```
STORAGE_DRIVE_ROOT
STORAGE_AGENT_PORTAL_HOST
STORAGE_AGENT_PORTAL_PORT
STORAGE_SECRET_DIR
```

선행 plan 의 원본 8항목 중 4·5 가 논리적으로 모순이었고 8은 재현 불가라, 아래 정정본을 사용한다.

- [ ] web UI 발급 → 다이얼로그에 password 평문 표시 + 마스킹 토글 동작
  > PR #80 이 고친 결함이 여기서 드러났던 항목. 가장 먼저 확인
- [ ] `.ps1` 다운로드 동작 + 파일 내용에 password 가 올바르게 삽입됨
- [ ] elevated PowerShell 에서 `.ps1` 실행 → 1분 안에 `Get-Disk` 에 새 디스크
- [ ] **발급 직후(회수 전)** 같은 driveId 재발급 → `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL`
- [ ] web UI 회수 → 1분 안에 `Get-Disk` 에서 disk 사라짐
- [ ] **회수 후 재발급 → 정상 발급** (Task 1 미적용 시 여기서 500 발생 — P-1 재현 지점)
- [ ] 발급 다이얼로그를 닫은 뒤 GET 목록 API 응답에 password/script 필드 미포함
- [ ] 조회 실패 상태(예: API 중단) 에서 "불러오지 못했습니다" 오류 표시 — 빈 상태로 표시되지 않음
  > PR #80 이 추가한 error 분기 확인

원본 항목 8("특수문자 password 로 escape 확인")은 생성기가 base64url 고정이라 수동 재현이 불가능하므로 smoke 에서 제외하고 `script-template` 단위 테스트로 대체한다 (이미 존재).

## Validation Commands

```bash
# API 단위 + 타입
npm --prefix services/api test -- mount-credential
npm --prefix services/api run build

# 마이그레이션 생성 결과 확인 (Task 1)
npm --prefix services/api run db:generate
git diff services/api/drizzle/

# e2e (fakedsm)
npm --prefix services/api run test:e2e -- mount-credential

# codegen 재생성 후 drift 확인 (Task 4)
npm --prefix services/web run openapi:codegen
git diff services/web/src/shared/api/generated/ | grep -A3 "iqn"

# Web 전체
npm --prefix services/web test -- --run
npm --prefix services/web run build

# 보안 — nested 경로까지 (Task 3 에서 갱신)
grep -rn "osPassword\|\.password" services/api/src --include=*.ts | grep -i "log\|error" 
```

## Risks

| 리스크 | 확률 | 영향 | 완화 |
|---|---|---|---|
| partial unique index 마이그레이션이 기존 운영 데이터에서 실패 | L | H | 적용 전 `SELECT drive_id,user_id,protocol,count(*) FROM mount_credentials WHERE revoked_at IS NULL GROUP BY 1,2,3 HAVING count(*)>1` 로 확인. 기존 제약 때문에 결과가 나올 수 없지만 무증상 실패보다 명시적 확인이 낫다 |
| `db:generate` 가 제약 DROP 을 누락하고 index 만 추가 | M | H | 생성 SQL 육안 검토가 Task 1 의 필수 단계. DROP CONSTRAINT 가 없으면 수동 추가 |
| pino redact 경로가 실제 AxiosError 구조와 불일치 | M | M | Task 3 을 RED 부터 시작 — 실제 실패를 발생시켜 로그 출력을 눈으로 확인한 뒤 redact 경로 결정. 추측으로 경로를 쓰지 않는다 |
| Task 4 codegen 재생성이 무관한 diff 를 대량 유발 | M | L | 생성 diff 를 `iqn` 관련으로 한정 확인. 무관 변경이 크면 codegen 버전 drift 를 별도 이슈로 분리 |
| manual smoke 가 P-1 에서 막혀 이후 항목 검증 불가 | H | M | Task 1 을 smoke 보다 먼저 완료. 순서 역전 금지 |

## NOT Building

- catalyst → headless 마이그레이션 (design-system-v1 Milestone 2 소관)
- `.ps1` 서버 다운로드 endpoint 구현 — Task 5 에서 **결정만** 하고 구현은 결정 후 별도 plan
- 다중 탭 동기화 / 세션 만료 중 발급 처리 (P-6) — Risks 등재만, 구현은 범위 밖
- share-grants, file/folder 도메인 일체

## Acceptance Criteria

- [ ] `mount_credentials` 의 unique 가 `revoked_at IS NULL` partial index 로 교체됨
- [ ] 마이그레이션 SQL 에 기존 CONSTRAINT DROP 이 포함됨
- [ ] 회수 → 재발급 round-trip 이 repository 단위 + e2e 양쪽에서 통과
- [ ] 발급 직후(회수 전) 재발급은 여전히 `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL`
- [ ] agent 호출 실패 시 로그 출력에 평문 password 0건 (테스트로 단언)
- [ ] codegen `iqn` 이 `string | null` 로 생성되고 `formatIqn` 우회가 제거됨
- [ ] P-2 · P-3 · I-4 각각에 채택/기각 결정이 선행 plan Risks 표에 기록됨
- [ ] Task 9 manual smoke 8항목 통과
- [ ] 선행 plan frontmatter `status` 가 `done`
- [ ] 본 plan frontmatter `status` 가 `done`

## 다음 세션 시작 절차

```bash
# 본 브랜치는 plan 만 담고 있다. 새 worktree 에서 구현 진행
git worktree add .worktrees/mount-credential-hardening fix/mount-credential-hardening
scripts/worktree-bootstrap.sh .worktrees/mount-credential-hardening
cd .worktrees/mount-credential-hardening

# Task 1 부터 — 가장 영향이 크고 다른 Task 의 전제조건
```

Task 순서는 **1 → 2 → 9(smoke 앞 4항목) → 3 → 4 → 5 → 9(전체)** 를 권장한다. P-1 을 먼저 풀어야 smoke 가 중간에 막히지 않는다.

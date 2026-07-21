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

## Grounding 검증 (2026-07-22)

`/mccp:plan` Phase 2 GROUND 에서 본 plan 이 인용한 코드 증거를 직접 대조했다. **P-1 은 인용 4건이 모두 정확히 일치**하며 결함은 실재한다.

| 주장 | 실제 | 판정 |
|---|---|---|
| `mount-credentials.schema.ts:30` — `t.unique().on(driveId, userId, protocol)` | 동일 | 일치 |
| `mount-credential.repository.ts:59` — `softRevoke` 가 행을 남김 | 동일 | 일치 |
| `mount-credential.repository.ts:25` — 중복 검사가 `isNull(revokedAt)` | 동일 (조건은 line 38) | 일치 |
| `drizzle/0006_dashing_hiroim.sql:25` — `CONSTRAINT ... UNIQUE` | 동일 | 일치 |

그 과정에서 Task 3·4 의 **대상 위치가 정정**된다. 아래 두 정정은 구현 전에 반영해야 한다.

### 정정 1 — Task 3(P-4) 의 누출 지점은 service 가 아니라 agent client

`storage-agent.client.ts:35` 가 `validateStatus: () => true` 로 설정돼 있어 **HTTP 오류 status 는 throw 하지 않는다.** 그 결과 오류 경로가 둘로 갈린다.

- **누출 O** — `storage-agent.client.ts:64`. `send()` 의 catch 에 도달하는 것은 *네트워크 계층 실패*(socket 부재·timeout)뿐이고, 이때 `logger.error({ err: axiosErr, ... })` 가 원본 AxiosError 를 그대로 직렬화한다. `axiosErr.config.data` 가 `createTarget` 요청 본문 `{ iqn, name, osUsername, osPassword }` 이므로 여기가 평문 password 누출 지점이다.
- **누출 X** — `mount-credential.service.ts:94` 의 `{ err }`. HTTP 오류는 `throwForResponse` 가 `ApiException` 으로 변환한 뒤 올라오므로 `config` 자체가 없다.

따라서 Task 3 의 RED 는 *agent 의 HTTP 오류 응답* 이 아니라 **네트워크 실패(소켓 미존재 등)** 를 재현해야 한다. HTTP 오류 경로로 테스트를 짜면 leak 이 재현되지 않아 GREEN 이 거짓으로 통과한다 — 보안 테스트가 통과했다는 착각이 무방비보다 위험하다.

기존 redact 경로(`logger.config.ts:18~30`)가 이 경로를 못 잡는 이유는 두 가지다.

1. 키 이름이 `password` 가 아니라 `osPassword` — 어떤 `*.password` 패턴도 매칭되지 않는다
2. `*.password` 의 `*` 는 한 단계만 매칭하므로 `err.config.data.*` 깊이에 닿지 않는다

### 정정 2 — Task 4(P-9) 의 수정 대상은 base DTO 한 곳

`iqn` 은 `IssueMountCredentialResponseDto` 가 아니라 상속원인 `mount-credential.dto.ts:16` 에 선언돼 있다.

```ts
@ApiProperty({ nullable: true })   // ← type: String 누락
iqn!: string | null;
```

[services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"Response DTO의 UUID / ENUM 표현" 이 정확히 이 회귀를 경고한다 — "`type: String` 명시 없이 `nullable` 만 주면 plugin 의 union 추론이 `Object` 로 fallback". base DTO 한 곳만 고치면 목록·발급 응답 양쪽이 동시에 해소되므로, plan 본문의 "API DTO 에 명시" 는 이 파일 1곳으로 확정한다.

> **인과는 이후 갱신됨** — 위는 *수정 대상 파일* 의 특정이고, 그 수정이 *원인* 이라는 주장은 Task 4 의 "Codex 정정 (F10·F11·F12)" 이 뒤집었다. `services/api/src/metadata.ts` 는 이미 `iqn: { type: () => String, nullable: true }` 를 갖고 있어 데코레이터 변경은 no-op 일 수 있다. 구현 시 Task 4 의 정정된 순서를 따를 것.

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


> **Codex 정정 (F1·F2·F3·F5)** — partial index 만으로는 부족하다. 현재 `issue()` 는 중복검사(`service.ts:44`)와 INSERT(`:67`) 가 한 트랜잭션이 아니고, 그 사이에서 외부 target 을 먼저 만든다(`:59`). `iqn` 이 `drive.id` 파생이라 **동시 발급 시 두 요청의 iqn 이 같으므로**, 패배자의 롤백 `deleteTarget(iqn)`(`:98`) 이 승자의 target 을 삭제한다 — 실사용 데이터 손상.
>
> 따라서 Task 1 에 아래를 포함한다.
>
> 1. **순서 역전** — `insertIssued` 를 `createTarget` **앞으로** 옮긴다. partial index 가 패배자를 외부 부작용 발생 전에 거른다
> 2. **23505 매핑** — insert 의 unique violation 을 `ApiException('MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL')` 로 변환한다. 미변환 시 패배자가 500 으로 나가 Task 1 의 계약이 미완성
> 3. **롤백 범위 축소** — 롤백은 *본 요청이 만든* target 만 지운다. 순서 역전이 이를 자연히 보장한다
> 4. **`sql` import 추가** — `.where(sql`…`)` 사용 시 `drizzle-orm` 에서 `sql` 을 import 해야 한다. 현재 스키마는 `drizzle-orm/pg-core` 만 import
>
> RED 는 "동시 발급 2건 중 1건만 성공하고, 실패한 쪽이 `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL` 이며, 성공한 쪽의 target 이 살아있다" 를 단언한다.

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


> **Codex 정정 (F6·F7·F9)** — pino redact 경로 추가는 **원리적으로 불가능한 접근**이다. axios 는 transformRequest 단계에서 body 를 JSON **문자열**로 직렬화하므로, `err.config.data` 는 객체가 아니라 password 를 포함한 문자열이다. `err.config.data.osPassword` 라는 경로 자체가 존재하지 않아 어떤 path 기반 redact 도 매칭되지 않는다.
>
> 따라서 Task 3 의 방법을 확정한다 — **원천 제거**. `storage-agent.client.ts:64` 의 catch 에서 원본 AxiosError 를 로깅하지 않고, 필요한 필드(`code`, `method`, `url`)만 whitelist 해 기록한다. [logging.md](../rules/ecc/common/logging.md) §"Never Log" 의 "전체 request 객체 로깅 금지 — 필요한 필드만 whitelist" 와 정확히 일치한다.
>
> RED 는 **네트워크 계층 실패**(소켓 부재 등)를 재현해야 한다 — `validateStatus: () => true`(`:35`) 때문에 HTTP 오류 경로로는 leak 이 재현되지 않아 GREEN 이 거짓 통과한다. 단언은 오류코드가 아니라 **직렬화된 로그 출력에 password 문자열이 없음** 이어야 한다 (`storage-agent.client.spec.ts:73` 은 오류코드만 보고 있어 불충분).

### Task 4 — P-9: codegen `iqn` 타입 drift 정정 (MEDIUM)

현재 `IssueMountCredentialResponseDto.iqn` 이 codegen 에서 `{[key: string]: unknown} | null` 로 나와, Web 이 `formatIqn(unknown)` 으로 우회 중이다. 실 wire-format 은 `string | null`.

1. API DTO 에 명시: `@ApiProperty({ type: String, nullable: true })`
   > [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"Response DTO의 UUID / ENUM 표현" — nullable union 은 `type` 명시가 없으면 plugin 이 `Object` 로 fallback 한다. 이 결함의 정확한 원인
2. dev 서버 reload 후 `npm --prefix services/web run openapi:codegen`
3. `iqn: string | null` 로 생성되는지 확인
4. Web 의 `formatIqn` 우회 제거 — `DriveMountPanel.tsx`, `IssueMountCredentialButton.tsx` 2곳
5. 테스트의 `as unknown as` cast 도 함께 제거 (`IssueMountCredentialButton.test.tsx:36`)


> **Codex 정정 (F10·F11·F12) — 근본 원인 진단이 틀렸다.** 검증 결과 `services/api/src/metadata.ts` 는 **이미** `iqn: { type: () => String, nullable: true }` 를 갖고 있다. 즉 swagger plugin 은 정상 추론하고 있고, `@ApiProperty` 에 `type: String` 을 추가하는 것은 **no-op 일 가능성이 크다**. 실제 원인은 web `types.gen.ts` 가 **stale** 한 것 — 구버전 서버 상태에서 생성된 산출물이 커밋돼 있다.
>
> 따라서 Task 4 의 순서를 바꾼다.
>
> 1. **먼저 재생성** — dev 서버를 띄우고 `openapi:codegen` 을 돌린 뒤 `iqn` 이 `string | null` 로 나오는지 확인한다. 여기서 해소되면 DTO 수정은 불필요
> 2. 해소되지 않을 때만 DTO 를 손댄다 — 그때 비로소 데코레이터가 원인이라는 근거가 생긴다
> 3. **diff gate 강화** — `openapi-ts.config.ts:4` 가 live `http://localhost:3000/json` 에서 pull 하므로 산출물이 서버 상태에 따라 흔들린다. `iqn` 만 grep 하는 것은 불충분하고, **generated diff 전체를 검토**한다
> 4. **무관 회귀 주의** — `types.gen.ts` 에 iqn 외 object fallback 이 이미 2건 있다 (`CompleteChallengeBodyDto.type:76`, `TrashActionBodyDto.type:274`). 전체 재생성이 이들을 바꾸면 무관한 cast 가 깨질 수 있다
>
> 이 정정이 없었다면 no-op 데코레이터를 추가한 뒤 재생성으로 고쳐진 것을 보고 **틀린 인과를 코드베이스에 박제**했을 것이다.

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

## Design Critique

- 트리거: `impeccable-detect --mode plan` → `skill_available=true` / `design_signal=true`
- 신호 파일: `DriveMountPanel.tsx`, `IssueMountCredentialButton.tsx` (Task 4 가 언급)
- 결과: **skipped (auto-fallback)** — `NO_PRODUCT_MD`

> impeccable unavailable, skipped (auto-fallback): NO_PRODUCT_MD — 스킬은 설치돼 있으나 `context.mjs` 가 프로젝트 `PRODUCT.md` 부재로 critique 진입을 차단. 해소하려면 `/impeccable init` 이 저장소 전역 `PRODUCT.md`·`DESIGN.md` 를 신설해야 한다.

**skipped 로 처리한 근거**: 본 plan 이 두 `.tsx` 에 가하는 변경은 Task 4 의 `formatIqn(unknown)` 타입 우회 및 `as unknown as` cast 제거뿐으로 **시각적 변경이 0** 이다. 그 게이트를 통과시키려 저장소 전역 디자인 문서를 신설하는 것은 [CLAUDE.md](../../CLAUDE.md) §"코드 작성 spec" 의 "요청 범위를 벗어난 기능 확장 금지" 에 저촉된다. `mccp-plan-codex` 는 lenient gate 이므로 `meta.impeccable_skipped=true` 는 warning 으로 기록되고 통과를 위조하지 않는다.

**후속 조건** — 향후 이 두 컴포넌트에 *실제 시각 변경* 이 필요해지면 그 시점의 plan 에서 `/impeccable init` 을 선행 task 로 등재한다. 본 plan 범위에서는 등재하지 않는다.

## Design Routing Guide

routing mode: `auto` (implement 단계에서 유효). plan 단계는 렌더된 UI 가 없으므로 **invoke 하지 않고 체크리스트로만** 기록한다. 본 plan 은 시각 변경이 없어 아래 중 어느 것도 실제 수행 대상이 아니다.

| Stage | Command |
|---|---|
| evaluate | `/impeccable critique` |
| evaluate | `/impeccable audit` |
| polish | `/impeccable polish` |

<details><summary>+17 more (discovery / refine / simplify / harden / system)</summary>

| Stage | Command |
|---|---|
| discovery | `/impeccable shape` |
| refine | `/impeccable layout` |
| refine | `/impeccable typeset` |
| refine | `/impeccable animate` |
| refine | `/impeccable colorize` |
| refine | `/impeccable bolder` |
| refine | `/impeccable quieter` |
| refine | `/impeccable overdrive` |
| refine | `/impeccable delight` |
| simplify | `/impeccable adapt` |
| simplify | `/impeccable distill` |
| simplify | `/impeccable clarify` |
| harden | `/impeccable harden` |
| harden | `/impeccable optimize` |
| harden | `/impeccable onboard` |
| system | `/impeccable document` |
| system | `/impeccable extract` |

</details>

## Codex Adversarial Review

- 호출: `codex exec --sandbox read-only` (gpt-5.5, reasoning xhigh) — **직접 호출 경로**. mccp `codex-invoke.js` 래퍼는 stdin 미종료로 hang 하여 사용 불가 (아래 "게이트 실행 환경" 참조)
- 라운드 수: 1 (R1 흡수로 해소 — ACCEPT_NOW HIGH 잔존 0)
- 합치 결론: Task 1 은 과거 재발급 버그는 고치나 **동시 발급·롤백 위험**은 남긴다. Task 3 은 pino redact 가 아니라 **axios config 를 원천에서 제거**해야 한다. Task 4 는 근본 원인 진단이 틀렸다 — 데코레이터가 아니라 **stale codegen** 이 원인.

### YAGNI Triage

| Finding | Severity | Verdict | Why |
|---|---|---|---|
| F1 `service.ts:44` check-then-act race — 동시 `issue()` 둘 다 중복검사 통과 | HIGH | ACCEPT_NOW | partial index 도입 후 패배자가 500(23505)으로 나감. Task 1 의 계약("중복은 도메인 오류")이 미완성 |
| F2 `service.ts:59` DB insert 전에 외부 target 생성 | HIGH | ACCEPT_NOW | F3 과 동일 근원. 순서 역전으로 동시 해소 |
| F3 `service.ts:98` 롤백 `deleteTarget(iqn)` 이 **생존 credential 의 target 을 삭제** | HIGH | ACCEPT_NOW | `iqn` 이 `drive.id` 파생이라 동시 발급 시 두 요청의 iqn 이 같다. 패배자 롤백이 승자를 파괴 — 실사용 데이터 손상 |
| F4 `database.service.ts:35` 마이그레이션이 app init 중 실행, 인덱스 생성 락 미검증 | MEDIUM | DEFER_TO_BACKLOG | 단일 사용자 NAS 라 짧은 다운타임 허용. Risks 표에만 등재 |
| F5 `mount-credentials.schema.ts:1` `.where(sql\`…\`)` 에 `sql` import 필요 | LOW | ACCEPT_NOW | 1줄. 없으면 Task 1 구현 즉시 컴파일 실패 |
| F6 `storage-agent.client.ts:64` axios 가 body 를 **JSON 문자열로 직렬화**하므로 `err.config.data.osPassword` 경로 자체가 존재하지 않음 | HIGH | ACCEPT_NOW | **path 기반 redact 로는 원리적으로 불가능**. Task 3 의 접근을 바꾼다 |
| F7 `logger.config.ts:18` 현 redact 가 이 누출을 못 잡음 | HIGH | ACCEPT_NOW | plan 진단과 일치 — 근거 보강 |
| F8 `pii-masker.ts:7` 도 `osPassword` 누락 | MEDIUM | DEFER_TO_BACKLOG | StorageAgentClient 경로에서 도달 불가. "로그는 안전" 주장 범위만 좁힌다 |
| F9 `storage-agent.client.spec.ts:73` 기존 테스트가 오류코드만 단언 | LOW | ACCEPT_NOW | plan 의 RED 요구사항과 동일 |
| F10 `metadata.ts:26` 이 **이미** `iqn: String nullable` — 데코레이터 수정은 no-op | MEDIUM | ACCEPT_NOW | **직접 검증함**. Task 4 의 인과가 틀렸다 |
| F11 `openapi-ts.config.ts:4` codegen 이 live 서버에서 pull | MEDIUM | ACCEPT_NOW | **직접 검증함**. `iqn` 만 grep 하는 diff gate 불충분 |
| F12 `types.gen.ts:76,274` iqn 외 object fallback 2건 존재 | MEDIUM | ACCEPT_NOW | **직접 검증함**. 전체 재생성이 무관 cast 를 깨뜨릴 수 있음 |
| F13 다른 codegen 우회 2곳(trash-purge, file-search) | LOW | DEFER_TO_BACKLOG | Task 4 범위 밖 drift 부채 |

- Deferred to backlog: 3 (F4 · F8 · F13) → `.claude/plans/codex-findings-backlog.md`
- Open Questions: 없음 — ACCEPT_NOW HIGH/CRITICAL 전부 R1 에서 plan 본문에 흡수됨 (Task 1·3·4 각 "Codex 정정" 참조)
- auto-CRITICAL 카탈로그 해당: **없음** (최고 severity HIGH)

### 게이트 실행 환경 (재현용)

mccp `codex-invoke.js` 는 이 머신에서 `classification=timeout` 으로 실패한다. 원인은 인증·네트워크가 아니라 **stdin 미종료** — `codex exec` 는 프롬프트를 인자로 받아도 `Reading additional input from stdin...` 에서 첫 바이트 출력 전에 블록한다. `codex login status` 가 즉답하는 것이 감별 신호.

```js
// 동작하는 호출 형태 (shim 우회 + stdin 종료 + 출력 스트리밍)
spawn(process.execPath, [
  'C:/Program Files/nodejs/node_modules/@openai/codex/bin/codex.js',
  'exec', '--sandbox', 'read-only', focusText,
], { stdio: ['ignore', 'pipe', 'pipe'] })
```

본 리뷰는 위 경로로 실제 수행되었다 (`CODEX_EXIT=0`, 216,560 tokens). 래퍼 우회는 호출 방식만 바꾼 것이고 리뷰 내용·판정은 Codex 원본이다.

### receipt verdict 근거

`codex-bridge.parseVerdict` 에 실제 Codex 응답을 넣으면 **`unavailable`** 이 나온다. 오라클이 찾는 수렴 마커가 응답에 없기 때문인데, 본 호출의 프롬프트가 "findings 목록 + 한 줄 결론" 형식을 요구했기 때문이다 — 즉 *판정 불가* 이지 *Codex 불가* 가 아니다.

receipt 에는 **`divergent`** 를 기록한다.

- `unavailable` 은 의미상 거짓 — Codex 는 실제로 호출됐고 13건을 반환했다. 이 값을 쓰면 리뷰가 기계 판독 감사 기록에서 사라진다
- `converged` 는 검증되지 않은 주장 — "수정된 plan 에 Codex 가 동의한다" 는 뜻인데, 흡수 후 재리뷰를 하지 않았다
- `divergent` 은 실제로 일어난 일 그대로다. Codex 는 Task 1·3·4 **전부에서** plan 의 주장과 갈라섰고, 그 결과로 세 Task 가 수정됐다

부수 효과로 cross-gate dedupe 가 `converged` 이외의 값에 fail-closed 로 동작하므로, `/mccp:pr` 단계에서 이 plan 은 다시 검증을 요구받는다 — 수정 후 재리뷰가 없는 현 상태에서 이는 올바른 방향이다.

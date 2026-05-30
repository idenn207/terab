# Phase 3 Task 1~2 진행 보고서

- **PRD**: [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md) Phase 3
- **Plan**: [.claude/plans/network-storage-reframing-phase3-self-issuance-ui.plan.md](../plans/network-storage-reframing-phase3-self-issuance-ui.plan.md)
- **세션 범위**: 사전 점검 + Task 1 (ErrorCode/env) + Task 2 (DriveModule)
- **세션 결과**: 본 plan 의 9 Task 중 2 Task 완료, 7 Task 미완 — 다음 세션 인계
- **Branch**: `feat/storage-phase3-self-issuance-ui` (worktree `.worktrees/storage-phase3/`)
- **작성일**: 2026-05-29

---

## Summary

본 세션은 Phase 3 plan 의 9 Task 중 **Task 1 (ErrorCode + env)** 와 **Task 2 (DriveModule)** 를 TDD 사이클로 완수했습니다. 사전 점검 2건 (synowebapi.go IQN 처리·headless modal 부재) 도 동시에 처리해 Task 3 이후 진입 시점의 *known risks* 를 가시화했습니다.

- API 모듈 1개 신설 (`services/api/src/drive/`) — controller·service·repository·DTO·module·barrel + 3 spec 파일
- ErrorCode 6개 추가 (`DRIVE_*` 2개 + `MOUNT_CREDENTIAL_*` 4개)
- env 변수 4개 추가 (`STORAGE_DRIVE_ROOT`/`STORAGE_AGENT_PORTAL_{HOST,PORT}`/`STORAGE_SECRET_DIR`)
- AppModule 에 DriveModule 등재
- 단위 테스트 12 / 3 suites 전부 PASS, drive scope tsc 에러 0 건

다음 세션은 Task 3 (`secret-store`) 부터 진입 가능. Task 5/7/9 에서 영향을 줄 *headless modal 부재 risk* 는 본 보고서 §"인계 — 다음 세션 가드레일" 항목에 명시했습니다.

---

## Assessment vs Reality

| Metric | Plan 예상 | 실제 |
|---|---|---|
| Complexity (Task 1~2 한정) | Small~Medium | Small — mirror pattern (twofa) 가 명확해 mock·spec 구조 그대로 답습 |
| Confidence | High | High — drive scope tsc 0 에러 + spec 12/12 |
| Files Changed (Task 1~2) | 약 10개 (ErrorCode + env + drive 9개) | 4 modified + 9 created = 13개 (barrel + spec 포함) |
| Soak time | API Task 1+2 만 1~2시간 | 실제 약 30분 (research 시간 절약: ToolSearch + 병렬 Read) |

---

## Tasks Completed (본 세션)

| # | Task | Status | Notes |
|---|---|---|---|
| 0 | 사전 점검 — synowebapi.go IQN / headless modal / DSM env | 완료 | synowebapi 가 명시 IQN(`iqn.YYYY-MM.com.terab:{driveId}`) 을 그대로 받음 확인 ([synowebapi.go:122](../../services/storage-agent/internal/dsm/synowebapi.go#L122)). modal 부재 확인 — Task 7 인계 |
| 1 | ErrorCode 6 + env 4 | 완료 | enum 구조 (`as const satisfies Record<string, ErrorCodeDefinition>`) 그대로 유지, 추가 키만 끝부분에 |
| 2 | DriveModule scaffold (TDD) | 완료 | repository·service·controller + 3 spec + module + dto + barrel, AppModule 등재. TDD RED→GREEN 1회 (mock setup 누락 → setupMockDbTransactionChain 추가) |

## Tasks Remaining (인계 대상)

| # | Task | 의존 | 비고 |
|---|---|---|---|
| 3 | secret-store 추상화 (file-based, Docker Secret) | Task 1 의 `STORAGE_SECRET_DIR` + `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED` | dev 환경 `os.tmpdir()` fallback, `chmod 0600` 필수 |
| 4 | script-template (`.ps1` 렌더링) | 독립 | password 가 base64url 한정 — escape risk 낮으나 `"`, `` ` ``, `$` 케이스 테스트 필요 |
| 5 | MountCredentialModule core (issue + revoke + list) | Task 2 + Task 3 + Task 4 + Phase 2 의 `StorageAgentClient` | 가장 큰 Task — issue 응답 DTO 에 `password` + `script` 1회용 필드, 실패 시 rollback (agent + secret) |
| 6 | Web entity slice 2개 + codegen 재생성 | Task 5 (API 측 OpenAPI 갱신) | `npm run openapi:codegen` 출력 검증 |
| 7 | Web feature slice 2개 (TDD) | Task 6 + **headless modal** | minimal modal 신설 불가피 |
| 8 | widget + page 확장 | Task 7 | DriveMountPanel — 자체 비즈니스 로직 0 |
| 9 | E2E + manual smoke + PRD/plan 갱신 | Task 1~8 전부 | manual smoke 는 본인 NAS 환경 의존 |

---

## Validation Results (본 세션 범위)

| Level | Status | Notes |
|---|---|---|
| 정적 분석 — tsc (drive scope) | PASS | `npx tsc --noEmit 2>&1 \| grep drive` → 0 매치. baseline 의 `metadata.ts` + `file.service.spec.ts` 에러는 사전 존재 — 본 PR 책임 외 |
| 단위 테스트 — `npm test -- drive` | PASS | 3 suites, 12 tests 전부 PASS. TDD 1차 cycle 에서 mock setup 누락 1건 즉시 fix |
| grep 검증 — Plan VALIDATE 1·2 | PASS | ErrorCode 6 키 매치 + env 4 변수 매치 + barrel 존재 + AppModule import 존재 |
| dev 서버 smoke | SKIP | 본인 NAS + JWT 발급 필요. plan Task 9 의 manual smoke 와 묶어 다음 세션 |
| 빌드 (`nest build`) | SKIP | tsc + jest 통과로 본 세션 acceptance gate 통과. build 는 다음 commit 직전 1회로 충분 |

---

## Files Changed (본 세션)

| File | Action | Lines |
|---|---|---|
| `services/api/src/common/exceptions/error-code.enum.ts` | UPDATED | +24 / -0 (6 ErrorCode 키) |
| `api.env.example` | UPDATED | +12 / -0 (4 env 변수 + 섹션 주석) |
| `services/api/src/app.module.ts` | UPDATED | +2 / -0 (DriveModule import + 등재) |
| `services/api/src/drive/dto/drive.dto.ts` | CREATED | +25 |
| `services/api/src/drive/drive.repository.ts` | CREATED | +30 |
| `services/api/src/drive/drive.repository.spec.ts` | CREATED | +86 |
| `services/api/src/drive/drive.service.ts` | CREATED | +44 |
| `services/api/src/drive/drive.service.spec.ts` | CREATED | +85 |
| `services/api/src/drive/drive.controller.ts` | CREATED | +27 |
| `services/api/src/drive/drive.controller.spec.ts` | CREATED | +63 |
| `services/api/src/drive/drive.module.ts` | CREATED | +11 |
| `services/api/src/drive/index.ts` | CREATED | +2 |
| `.claude/plans/network-storage-reframing-phase3-self-issuance-ui.plan.md` | UPDATED (status) | pending → in-progress |
| `.claude/prds/network-storage-reframing.prd.md` | UPDATED (status) | Phase 3 row pending → in-progress |

> 본 세션 diff 에 `services/api/src/file/**`, `services/api/src/folder/**`, schema 변경, share-grants 코드 변경 **0줄** — plan 의 "NOT Building" 항목 모두 준수.

---

## Tests Written (본 세션)

| Test File | Tests | Coverage 범위 |
|---|---|---|
| `services/api/src/drive/drive.repository.spec.ts` | 5 | findPersonalByOwnerId (null/row) · findById (null/row) · create (insert→returning) |
| `services/api/src/drive/drive.service.spec.ts` | 5 | ensurePersonalDrive (idempotent + lazy create with `${root}/${driveId}`) · findByIdOrThrow (NOT_FOUND·FORBIDDEN·OK) |
| `services/api/src/drive/drive.controller.spec.ts` | 2 | getMyDrive (DTO 매핑 — ownerId/updatedAt/quotaBytes 미노출) · getDrive (`(driveId, userId)` 순서) |

---

## Deviations from Plan

| Deviation | What | Why |
|---|---|---|
| spec mock 보강 (1줄) | `setupMockDbTransactionChain()` 호출을 `drive.service.spec.ts` 의 `beforeEach` 에 추가 | `ServiceCore.runInTx` 가 `txContext.current = undefined` 일 때 `database.db.transaction(callback)` 을 호출 — mock 의 default 가 undefined 반환이라 callback 미실행. mocks 파일이 이미 헬퍼 제공 (`setupMockDbTransactionChain`) — plan 의 mirror reference 인 `totp.repository.spec.ts` 가 insert/update 만 사용해 본 헬퍼 사용 사례 없음. service spec 의 신규 사용 패턴 |

---

## Issues Encountered

1. **baseline tsc 에러 — 본 PR 책임 외**
   - `src/metadata.ts` — Swagger plugin 의 build-time 산출물. `nest build`/`start:dev` 시 자동 재생성됨. 본 세션은 dev 서버 미기동
   - `src/file/file.service.spec.ts(66,73)` — Rename/Move dto 자리에 string 직접 전달하는 stale spec. v0.1 baseline 에 이미 존재 (git stash 로 재현 확인)
   - 해결: 본 PR 범위 외. 별도 PR 로 정리 권장

2. **TDD GREEN cycle 1회 — mock setup 누락**
   - `ensurePersonalDrive` 가 `undefined` 반환. 진단 즉시 root cause 식별 (mock transaction chain 누락)
   - 해결: 1줄 수정 → 재실행 → 12/12 통과

---

## 인계 — 다음 세션 가드레일

### Risk A — `services/web/src/shared/ui/` 에 headless modal 부재

| 항목 | 내용 |
|---|---|
| 위치 | `services/web/src/shared/ui/catalyst/` 만 존재. `dialog/` 가 catalyst kit 하나 |
| 영향 시점 | **Task 7** (`mount-credential-issue` feature 의 1회용 다이얼로그) |
| Mitigation 방안 | (a) Task 7 진입 첫 작업으로 `services/web/src/shared/ui/modal/` minimal headless 신설 — mobile-ui-guide §2.2 Modal anatomy 답습, token utility 만 사용, catalyst 의존 0. (b) PRD design-system-v1 Milestone 2 의 정식 modal 컴포넌트가 본 작업 *중* 들어오면 즉시 교체 |
| 결정 권한 | Task 7 시작 시 worktree 작업자 — plan 의 Risk row 8 에 명시된 합의 그대로 |

### Risk B — Phase 2 spike 의 CHAP disabled path vs Task 5 의 CHAP enabled path

| 항목 | 내용 |
|---|---|
| 사실 확인 | Phase 0 spike 는 CHAP disabled 로 검증. Phase 3 (본 plan Task 5) 는 CHAP enabled — synowebapi 호출 path 가 신규 |
| 영향 시점 | **Task 5** (MountCredentialModule.issue → `storageAgentClient.createTarget(iqn, name, osUsername, osPassword)`) |
| Mitigation 방안 | fakedsm e2e 통과 ≠ 실 DSM 통과. Task 9 의 manual smoke 가 최종 가드 |

### Risk C — Task 5 의 issue 실패 cleanup 순서

| 항목 | 내용 |
|---|---|
| 권장 순서 | (1) secret-store write → (2) agent.createTarget → (3) DB insert. (3) 실패 시 (2) rollback (`storageAgentClient.deleteTarget`) → (1) rollback (`secretStore.remove`) |
| 명시 출처 | plan Risk row 4 |

### Task 1 에서 합의된 결정 (다음 세션이 그대로 사용)

- **ErrorCode 매핑**:
  - `DRIVE_NOT_FOUND` → 404, `DRIVE_FORBIDDEN` → 403
  - `MOUNT_CREDENTIAL_NOT_FOUND` → 404, `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL` → 409 (Phase 1 unique 제약 위반 시), `MOUNT_CREDENTIAL_REVOKED` → 410 GONE, `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED` → 500
- **env 값 (api.env.example)**:
  - `STORAGE_AGENT_PORTAL_HOST=192.168.0.5`, `STORAGE_AGENT_PORTAL_PORT=3260`
  - `STORAGE_DRIVE_ROOT=/volume1/drives`
  - `STORAGE_SECRET_DIR=/run/secrets` (dev 는 `os.tmpdir()/terab-secrets` fallback)
- **Drive 의 도메인 결정**:
  - `kind = 'PRIVATE'` literal — personal drive 의 판정 키
  - `name = '내 드라이브'` (도메인 용어 한글, plan §"도메인 용어")
  - `mountPath = ${STORAGE_DRIVE_ROOT}/${driveId}` — driveId 가 uuid 라 unique 제약 자연 충족
  - id 를 Node 측에서 `crypto.randomUUID()` 로 미리 발급 (drives.id 는 `defaultRandom` 인데 mountPath 를 INSERT 전에 결정해야 하므로)
  - lazy 생성은 `runInTx` 으로 — 동시 호출 race 완화

### 코드 컨벤션 (services/api/CLAUDE.md 준수 확인)

- 컨트롤러 데코레이터 순서: HTTP verb → `@HttpCode`(생략 가능 — GET 200) → `@ApiOperation` → `@ApiResponse` → `@ApiError` ✅
- `@ApiError('DRIVE_NOT_FOUND', 'DRIVE_FORBIDDEN')` — ErrorCode 키 기반, raw `@ApiResponse 4xx` 없음 ✅
- `@CurrentUser() user: AuthUser` 패턴 ✅
- Response DTO: UUID 는 `@ApiProperty({ format: 'uuid' })`, enum 은 `@ApiProperty({ enum: ['PRIVATE'] })`, Date 는 명시 불필요 ✅
- `ApiException` 만 throw, framework exception (NotFoundException 등) 미사용 ✅
- ServiceCore 자손 → public 메서드 자동 trace, 별도 `logger.info` 추가 없음 ✅

---

## Artifacts (본 세션)

- 보고서: `.claude/reports/network-storage-reframing-phase3-task1-2-report.md` (본 파일)
- Plan: `.claude/plans/network-storage-reframing-phase3-self-issuance-ui.plan.md` (frontmatter status → in-progress)
- PRD: `.claude/prds/network-storage-reframing.prd.md` (Phase 3 row → in-progress)

## Next Steps (다음 세션 진입 시)

```
/ecc:prp-implement .claude/plans/network-storage-reframing-phase3-self-issuance-ui.plan.md
# Resume from Task 3 (secret-store) — 본 보고서 §"Tasks Remaining" 참조
```

또는 본 세션 분량을 commit 후 PR 으로 분리하는 경우:

```
/ecc:prp-commit  # commit 1: feat(api): drive 모듈 + ErrorCode/env 추가 (Phase 3 Task 1·2)
```

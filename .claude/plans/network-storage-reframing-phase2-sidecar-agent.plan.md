---
name: network-storage-reframing-phase2-sidecar-agent
description: Phase 2 — Go 로 작성한 storage-agent sidecar (.spk 배포 + synowebapi CLI 위임 + unix HTTP socket) 골격 + NestJS 클라이언트 wrapper
status: done
created: 2026-05-27
completed: 2026-05-27
---

> **진행 상태 (2026-05-27)**
>
> | Task | 상태 |
> |---|---|
> | Task 1 — agent 프로젝트 골격 | ✅ done |
> | Task 2 — unix socket HTTP 서버 + /healthz | ✅ done |
> | Task 3 — synowebapi CLI wrapper | ✅ done |
> | Task 4 — 3 HTTP handler (POST/GET/DELETE /v1/targets) | ✅ done |
> | Task 5 — .spk 빌드 + 설치 스크립트 | ✅ done |
> | Task 6 — fakedsm emulator | ✅ done |
> | Task 7 — NestJS StorageAgentClient + Module | ✅ done |
> | Task 8 — 통합 테스트 (round-trip) | ✅ done (Linux/macOS gated — Windows skip) |
> | Task 9 — PRD row 갱신 + 브랜치 통합 검증 | ✅ done |
>
> 1차 보고서(Task 1-4): [.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task1-4-report.md](../PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task1-4-report.md)
> 2차 보고서(Task 5-9): [.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-report.md](../PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-report.md)

# Plan: Phase 2 — Privileged Storage Agent (sidecar) 골격

## Summary

NestJS API 본체에 root 권한을 부여하지 않고, DSM 호스트의 SAN Manager(iSCSI target/LUN) 를 위임받아 조작하는 작은 **Go 데몬** 을 신설한다. 배포는 **Synology .spk 공식 패키지**, DSM 조작은 **synowebapi CLI** 위임, NestJS ↔ agent 통신은 **HTTP-over-unix-socket**. 본 phase 의 범위는 "골격" — 최소 viable agent + NestJS 클라이언트 wrapper + 통합 테스트 1개 (CreateTarget → GetTargetStatus → DeleteTarget) 까지. Phase 1 ([phase1-sot-adr-schema](network-storage-reframing-phase1-sot-adr-schema.plan.md)) 의 `drives`/`mount_credentials` 스키마와 같은 PR 묶음(`feat/storage-foundation` 브랜치) 에서 머지된다.

## User Story

As **본인 (operator + architect)**,
I want to **host OS daemon 관리 책임을 NestJS 본체에서 명시적으로 분리하고 root capability 가 닿는 표면을 최소화**,
so that **NestJS supply chain 공격이 storage 관리까지 도달하지 못하고, 향후 Phase 3 web 콘솔 발급 흐름이 검증된 boundary 를 호출만 하면 된다**.

## Problem → Solution

**현재 상태**: NestJS 가 DSM host OS 데몬을 조작할 어떤 통합도 없음. Phase 0 spike 가 SAN Manager 를 수동 조작으로 검증했지만, 그 절차를 NestJS 가 호출하려면 (a) root SSH credential 을 NestJS process 에 부여 — supply chain 표면 폭증, (b) NestJS 컨테이너에 host capability mount — 격리 무력화, 두 옵션 모두 PRD Risk 표 row 3 의 "H-likelihood" 위험에 해당.

**목표 상태**: (a) `storage-agent` 라는 별도 Go 데몬이 .spk 으로 DSM 에 설치되어 root 권한으로 실행, (b) unix socket 위에서 minimal HTTP API (`POST /targets`, `DELETE /targets/{id}`, `GET /targets/{id}`) 제공, (c) NestJS 가 `StorageAgentClient` 로 그 socket 을 호출 — capability 는 socket file 의 group permission 으로만 격리, (d) 통합 테스트가 agent 띄우고 dummy target 생성·조회·삭제까지 round-trip 통과.

## Metadata

- **Complexity**: Medium/Large — Go 프로젝트 신규 (`services/storage-agent/`) + Synology .spk 빌드 chain + NestJS 클라이언트 wrapper 가 세 갈래로 진행. Phase 0 spike 의 매뉴얼 절차를 자동화하는 1차 mapping 작업이 동반됨.
- **Source PRD**: [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md)
- **PRD Phase**: Phase 2 — Privileged storage agent (sidecar) 골격
- **Parallel with**: Phase 1 ([phase1-sot-adr-schema](network-storage-reframing-phase1-sot-adr-schema.plan.md)) — 같은 `feat/storage-foundation` 브랜치에서 진행. schema 형상(특히 `mount_credentials.iqn`) 이 agent API contract 와 정합해야 함
- **Estimated Artifacts**: ~15 — Go 모듈 (cmd + internal 4-5개 패키지) + .spk 빌드 산출물 + NestJS 클라이언트 module 3개 + 통합 테스트 + Makefile + Dockerfile (테스트용 emulator)
- **Estimated Duration**: 5-7일 (Go 골격 1일 + synowebapi wrapping 2일 + .spk 빌드 1일 + NestJS client + 테스트 2일)

## Resolved Decisions (질문 답변 반영)

| # | 결정 | 답변 | 근거 |
|---|---|---|---|
| **D1** | 언어 | **Go** | 표준 라이브러리만으로 unix socket + HTTP 서버 가능, cross-compile 용이, .spk 안에 단일 바이너리 = 의존 0, sidecar 의 정석 |
| **D2** | DSM 조작 방식 | **synowebapi CLI** (root SSH 또는 .spk 내부 실행) | SAN Manager UI 와 동일 API 경로, DSM 업데이트 건너도 안정적 — Web API 의 "비공식 + 버전 fragile" 위험 회피 |
| **D3** | 배포 | **Synology .spk 공식 패키지** | 부팅 자동 시작, DSM Package Center 관리, host namespace 직접 실행으로 synowebapi 호출이 자연스러움 |
| **D4** | unix socket 위치 | **`/var/packages/terab-agent/var/agent.sock`** (.spk 표준 var 경로) | .spk 설치 시 자동 생성, owner = `terab-agent` 시스템 계정, group = `terab` 으로 NestJS 컨테이너가 mount |
| **D5** | API protocol | **HTTP-over-unix-socket** (JSON body) | Go `net/http` + NestJS `axios` (`httpAgent` socketPath 옵션) 양쪽 표준, `curl --unix-socket` 으로 디버그 가능 — JSON-RPC/gRPC 보다 도구 친화 |

---

## UX Design

N/A — 본 phase 는 내부 인프라. agent 에 직접 닿는 사용자 UI 가 없고, NestJS API 도 본 phase 에선 endpoint 노출 안 함 (Phase 3 책임). 단, agent 의 로그 출력(stdout JSON line) 은 Phase 7 모니터링 UI 의 reference 가 된다.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md) §"Technical Approach", §"Risk 표 row 3" | sidecar 분리 이유, root capability 최소화 원칙 |
| P0 | [docs/spikes/phase0-steam-network-storage.md](../../docs/spikes/phase0-steam-network-storage.md) §"Track A — iSCSI" | 본 agent 가 자동화해야 할 정확한 절차 (manual → automated) |
| P0 | [network-storage-reframing-phase1-sot-adr-schema.plan.md](network-storage-reframing-phase1-sot-adr-schema.plan.md) §"Files to Create — mount_credentials" | agent API contract 가 schema 컬럼(`iqn`, `osUsername`, `secretRef`) 과 정합해야 함 |
| P0 | [services/api/Dockerfile](../../services/api/Dockerfile) | builder/runner 2-stage 패턴 — agent test emulator 도 동일 패턴 |
| P1 | [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"새 모듈 생성 시 체크리스트" | NestJS `StorageAgentModule` 등록 절차 |
| P1 | [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"로거 사용" + [.claude/rules/ecc/common/logging.md](../../.claude/rules/ecc/common/logging.md) | agent 자체는 stdout JSON-line 로그, NestJS client 는 pino 인젝션 |
| P1 | [CLAUDE.md](../../CLAUDE.md) §"새 파일 줄바꿈" | Go 파일 = LF (Linux 실행), .spk 빌드 script = LF, NestJS TS = CRLF, README/문서 = CRLF |
| P2 | memory `feedback_bash_over_powershell` | agent 빌드/배포 script 는 bash (PowerShell 금지) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Synology Package Developer Guide | https://help.synology.com/developer-guide/ + `synopkg` man page | .spk = tar.gz of `INFO` + `package.tgz` + `scripts/`. `scripts/{preinst,postinst,prestart,start-stop-status}` 5개가 lifecycle hook |
| synowebapi CLI | DSM 7 `man synowebapi` (host 내), https://www.synology.com/en-global/support/developer | `synowebapi --exec api=SYNO.Core.ISCSI.LUN method=create version=1 ...` 형태. JSON 인자 + JSON 응답 |
| SYNO.Core.ISCSI.* API surface | DSM SAN Manager 가 호출하는 동일 endpoint (브라우저 네트워크 탭으로 reverse) | `SYNO.Core.ISCSI.Target`, `SYNO.Core.ISCSI.LUN`, `SYNO.Core.ISCSI.Node` 가 핵심 — Phase 2 는 이 3개만 wrap |
| Go `net/http` over unix socket | https://pkg.go.dev/net#UnixListener + https://pkg.go.dev/net/http#Server | `http.Server{Handler: ...}.Serve(net.UnixListener)` — 한 줄. TLS/인증 X (socket 파일 권한이 인증) |
| NestJS axios over unix socket | axios `httpAgent` + Node `http.Agent({ socketPath })` | `new HttpAgent({ socketPath: '/var/.../agent.sock' })` — axios `baseURL: 'http://localhost'` (호스트는 더미) |
| Go cross-compile for DSM | `GOOS=linux GOARCH=amd64` (대부분 DSM x86_64) — 본인 NAS 아키텍처는 `uname -m` 으로 확인 | DSM ARM 모델은 `GOARCH=arm64` — DS918+ 류는 amd64 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Plan 형식 | [network-storage-reframing-phase1-sot-adr-schema.plan.md](network-storage-reframing-phase1-sot-adr-schema.plan.md) | frontmatter + Summary/Story/Problem→Solution/Metadata/Mandatory Reading/External Doc/Patterns/Files/Tasks/Validation/Risks/Acceptance — 동일 골격 |
| 서비스 디렉토리 배치 | [services/](../../services/) (api, mq, web, nginx) | `services/storage-agent/` 신규 — 다른 서비스와 평행한 위치. Make target `make agent` 패턴 추가 |
| Dockerfile 2-stage | [services/api/Dockerfile](../../services/api/Dockerfile) | builder stage (Go 컴파일) + runner stage (alpine + non-root user). agent 자체는 .spk 배포지만 통합 테스트용 emulator 컨테이너에 동일 패턴 |
| NestJS 모듈 구조 | [services/api/src/twofa/](../../services/api/src/twofa/) | `storage-agent.module.ts` + `storage-agent.client.ts` (service 역할) + `storage-agent.types.ts` + `*.spec.ts`. controller 없음 (Phase 3 책임) |
| ServiceCore 상속 + auto-trace | [services/api/CLAUDE.md §"로거 사용"](../../services/api/CLAUDE.md) | `StorageAgentClient extends ServiceCore` — public 메서드 auto-trace |
| ApiException + ErrorCode | [services/api/src/common/exceptions/error-code.enum.ts](../../services/api/src/common/exceptions/error-code.enum.ts) | agent 응답이 4xx/5xx 면 `ApiException('STORAGE_AGENT_*')` 로 변환. 신규 ErrorCode 3-4개 추가 |
| 환경변수 설정 | [api.env.example](../../api.env.example) 형식 | `STORAGE_AGENT_SOCKET_PATH=/var/packages/terab-agent/var/agent.sock` 추가 |

---

## Files to Create / Update

### Agent (Go, 신규 서비스)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/storage-agent/cmd/agent/main.go` | CREATE | LF | entrypoint — flag parse + socket listener + graceful shutdown |
| `services/storage-agent/internal/server/server.go` | CREATE | LF | HTTP handler 라우팅 (`/healthz`, `/v1/targets`, `/v1/targets/{id}`) |
| `services/storage-agent/internal/server/handlers.go` | CREATE | LF | 3 endpoint handler — JSON decode → dsm 패키지 호출 → JSON encode |
| `services/storage-agent/internal/dsm/synowebapi.go` | CREATE | LF | `synowebapi` CLI wrapper — `exec.Command` + stdin/stdout JSON. 본 phase 의 핵심 영역 |
| `services/storage-agent/internal/dsm/types.go` | CREATE | LF | `Target`, `LUN`, `CreateTargetRequest` 등 Go struct (NestJS types.ts 와 wire-format 동일) |
| `services/storage-agent/internal/log/log.go` | CREATE | LF | structured JSON-line 로거 (`log/slog` 사용 — Go 1.21+) |
| `services/storage-agent/go.mod` | CREATE | LF | `module github.com/terab/storage-agent`, Go 1.22+. 외부 의존성 최소 (slog 표준, 가능하면 0 의존) |
| `services/storage-agent/go.sum` | CREATE (auto) | LF | 의존성 lock |
| `services/storage-agent/Makefile` | CREATE | LF | `build`, `test`, `spk`, `clean`, `install-dev` 타겟. cross-compile 환경변수 wrapping |
| `services/storage-agent/.gitignore` | CREATE | LF | `bin/`, `*.spk`, `tmp/` |
| `services/storage-agent/spk/INFO` | CREATE | LF | Synology .spk metadata (package name, version, arch, description) |
| `services/storage-agent/spk/scripts/postinst` | CREATE | LF | 설치 후 `terab-agent` 시스템 계정 생성 + var/ 디렉토리 권한 |
| `services/storage-agent/spk/scripts/start-stop-status` | CREATE | LF | DSM 의 service lifecycle hook (start/stop/status) |
| `services/storage-agent/spk/scripts/preuninst` | CREATE | LF | 제거 전 socket 정리 + dummy target 회수 |
| `services/storage-agent/README.md` | CREATE | LF | 빌드·설치·디버그 절차 (curl --unix-socket 예시 포함) |

### Agent emulator (테스트용 Docker, 신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/storage-agent/test/emulator/Dockerfile` | CREATE | LF | DSM synowebapi 가 없는 CI/로컬 환경에서 agent 를 테스트하기 위한 fake. dsm 패키지를 mock impl 로 wire |
| `services/storage-agent/test/emulator/fakedsm/main.go` | CREATE | LF | synowebapi 의 응답을 in-memory 로 흉내내는 stub 바이너리 — agent 의 `exec.Command` 가 PATH 에서 이걸 찾음 |

### NestJS 클라이언트 wrapper

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/src/storage-agent/storage-agent.module.ts` | CREATE | CRLF | `@Module` — `StorageAgentClient` provider |
| `services/api/src/storage-agent/storage-agent.client.ts` | CREATE | CRLF | axios + unix socket httpAgent. 메서드: `createTarget(iqn, ...)`, `deleteTarget(iqn)`, `getTargetStatus(iqn)` |
| `services/api/src/storage-agent/storage-agent.client.spec.ts` | CREATE | CRLF | 단위 테스트 — axios mock + agent 응답 4종(2xx/4xx/5xx/network error) |
| `services/api/src/storage-agent/storage-agent.types.ts` | CREATE | CRLF | wire-format 타입 (Go 의 types.go 와 1:1) |
| `services/api/src/storage-agent/index.ts` | CREATE | CRLF | re-export `StorageAgentClient`, types |
| `services/api/src/app.module.ts` | UPDATE | (보존) | `imports: [..., StorageAgentModule]` 추가 |
| `services/api/src/common/exceptions/error-code.enum.ts` | UPDATE | (보존) | `STORAGE_AGENT_UNAVAILABLE`, `STORAGE_AGENT_TARGET_CONFLICT`, `STORAGE_AGENT_TARGET_NOT_FOUND`, `STORAGE_AGENT_INTERNAL` 추가 |
| `api.env.example` | UPDATE | (보존) | `STORAGE_AGENT_SOCKET_PATH=/var/packages/terab-agent/var/agent.sock` 추가 |

### 통합 테스트 + 빌드 시스템

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/test/storage-agent.e2e-spec.ts` | CREATE | CRLF | NestJS → fakedsm-backed agent → CreateTarget → GetTargetStatus → DeleteTarget round-trip. socket 파일을 tmp 경로에 띄움 |
| `Makefile` | UPDATE | (보존) | `make agent`, `make agent-spk`, `make agent-emulator` 타겟 추가 |
| `docker-compose.yml` 또는 dev compose | UPDATE | (보존) | emulator 컨테이너 service 추가 (로컬 NestJS 가 mount 할 socket 경로 binding) |

### PRD + index

| File | Action | EOL | Justification |
|---|---|---|---|
| `.claude/prds/network-storage-reframing.prd.md` | UPDATE | (보존) | Phase 2 row status `pending` → `in-progress` (작업 시작), 종료 시 `complete` + PRP 컬럼에 본 plan 경로 |

> 본 PR 의 diff 에 `services/api/src/file/**`, `services/api/src/folder/**`, `services/web/**` 변경 0줄. agent 가 NestJS 의 file/folder 모듈을 호출하지 않는다 (Phase 5/6 책임).

## NOT Building

- **HTTP REST endpoint 노출**: NestJS 의 `StorageAgentClient` 는 service 레이어 — controller/Swagger 도큐먼트 0개. Phase 3 web 콘솔 발급 UI 가 이걸 호출하는 controller 를 만든다.
- **사용자별 권한 검증**: agent 는 호출자(NestJS)를 신뢰 — socket 파일 권한이 사실상의 인증. 사용자 RBAC 는 NestJS 컨트롤러 레이어(Phase 3+) 책임.
- **secret store 통합**: `mount_credentials.secretRef` 가 실제 가리키는 Docker Secret 파일 생성은 본 phase 외. agent 는 발급된 자격증명을 "이 IQN 에 이 username 으로 ACL 추가" 형태로만 받는다. 자격증명 생성·저장은 Phase 3 의 web 발급 UI.
- **multi-protocol (SMB) 지원**: ADR-0004 결정대로 iSCSI 만. SMB 관련 endpoint 는 agent 에도 client wrapper 에도 없음.
- **quota / drive 단위 추적**: agent 는 IQN 단위 operation 만 — drive 와 IQN 의 mapping 은 NestJS 레이어가 `drives` 테이블로 관리.
- **production 모니터링 통합**: agent stdout 로그만. Prometheus exporter 같은 metrics endpoint 는 Phase 7.
- **graceful failover / HA**: 단일 NAS 단일 agent 가정. multi-NAS 는 v2+.
- **TypeScript codegen 자동화**: types.ts 와 types.go 동기화는 본 phase 에선 수동. 향후 swagger 와 같은 단일 source of truth 도입은 별도 결정.

---

## Step-by-Step Tasks

### Task 1 — agent 프로젝트 골격 (Go 모듈 + Makefile + 디렉토리)

- **ACTION**: `services/storage-agent/` 디렉토리 + Go 모듈 초기화 + Makefile + .gitignore + README.md
- **MIRROR**: `services/api/Dockerfile` 의 2-stage 패턴, `services/api/` 의 README 톤
- **CONTENT 가이드**:
  - `go.mod`: `module github.com/terab/storage-agent`, `go 1.22`
  - `Makefile`: `build` (현재 OS), `build-linux-amd64` (DSM 타겟), `test`, `spk`, `clean`, `install-dev` (로컬 dev socket 경로)
  - README: 빌드 → 설치 → 디버그 (`curl --unix-socket ... http://localhost/healthz`) 3단계
- **VALIDATE**:
  - `cd services/storage-agent && go mod tidy` exit 0
  - `make build` 가 `bin/agent` 생성
  - `bin/agent --help` 가 flag 목록 출력 (`-socket`, `-log-level`)

### Task 2 — unix socket HTTP 서버 + `/healthz`

- **ACTION**: `cmd/agent/main.go` + `internal/server/server.go` 작성. `/healthz` 만 먼저 (DSM 통합은 Task 3+)
- **MIRROR**: Go 표준 `net/http` 패턴. 다른 sidecar OSS (예: `github.com/uber-go/zap`, `linuxkit/virtio-tools`) 의 socket 라이프사이클 참고
- **CONTENT 가이드**:
  - SIGINT/SIGTERM 시 graceful shutdown (`http.Server.Shutdown(ctx)`)
  - socket 파일 권한: `0660` + chown to `terab-agent:terab`
  - 시작 시 stale socket 파일 자동 정리
- **VALIDATE**:
  - `./bin/agent -socket /tmp/test.sock &` 띄운 후 `curl --unix-socket /tmp/test.sock http://localhost/healthz` 가 `{"status":"ok"}` 반환
  - SIGTERM 보내면 5초 내 정상 종료 + socket 파일 삭제
  - 단위 테스트: `httptest.NewServer` 로 핸들러 직접 호출

### Task 3 — synowebapi CLI wrapper (`internal/dsm/`)

- **ACTION**: `internal/dsm/synowebapi.go` + `internal/dsm/types.go` 작성. CreateTarget / DeleteTarget / GetTargetStatus 3개 메서드만
- **MIRROR**: Phase 0 spike report 의 SAN Manager 조작 흐름 (`SAN Manager → Target → Create`) — 같은 API 를 CLI 로 호출
- **GOTCHA**:
  - synowebapi 가 root 권한 필요 — Task 5 의 .spk 안에서만 동작. 로컬 dev 는 fakedsm emulator 로
  - synowebapi 의 JSON 응답이 `{"success": true, "data": ...}` 형식 — Go struct 의 `json` tag 정확히
  - IQN 명명 규칙: `iqn.YYYY-MM.com.terab:<drive-id>` — drive 단위 격리
- **CONTENT 가이드**:
  - `type Client struct { execCmd func(...) ([]byte, error) }` — `execCmd` 를 인터페이스로 빼서 emulator 가 mock 가능하게
  - `CreateTarget(ctx, req CreateTargetRequest) (TargetID, error)` 시그니처
- **VALIDATE**:
  - `go test ./internal/dsm/...` 통과 — execCmd mock 으로 happy path + 4종 error path (CLI not found, JSON parse 실패, success=false, timeout)
  - 단위 테스트 커버리지 ≥ 80% (`go test -cover`)

### Task 4 — agent HTTP handler 3개 (`POST /v1/targets`, `DELETE /v1/targets/{id}`, `GET /v1/targets/{id}`)

- **ACTION**: `internal/server/handlers.go` 에 3개 핸들러 + server.go 의 라우팅에 연결
- **MIRROR**: NestJS controller 의 책임 분리 (요청 decode → service 호출 → 응답 encode). Go 라우팅은 표준 `http.ServeMux` (1.22+ 의 `{id}` 패턴) 사용 — 외부 라우터 의존 0
- **CONTENT 가이드**:
  - 4xx 응답: `{"error":{"code":"TARGET_CONFLICT","message":"..."}}` (NestJS 의 ApiException 응답 envelope 와 형식 일치)
  - 5xx 응답: 동일 형식 + log.Error
  - 요청 size limit 1MB (DoS 방어)
- **VALIDATE**:
  - emulator (Task 6) 없이도 핸들러 단위 테스트 통과 — dsm.Client 를 mock 으로 주입
  - `httptest.NewRecorder` 로 3개 endpoint × happy/4xx/5xx = 9개 케이스

### Task 5 — .spk 빌드 + 설치 스크립트 (`spk/`)

- **ACTION**: `spk/INFO`, `spk/scripts/{postinst,preuninst,start-stop-status}` + `Makefile` 의 `spk` 타겟
- **MIRROR**: Synology Package Developer Guide 의 minimal example
- **CONTENT 가이드**:
  - `INFO`: `package=terab-agent`, `version=0.1.0`, `arch=x86_64`, `description="Terab Storage Agent"`, `maintainer=terab`, `displayname=Terab Storage Agent`, `startable=yes`
  - `postinst`: `synouser --add terab-agent` + `synogroup --add terab` + var 디렉토리 권한
  - `start-stop-status`: case 분기 — start = nohup agent &, stop = SIGTERM + socket cleanup, status = pid 확인
  - `preuninst`: 모든 dummy target 회수 (`curl --unix-socket ... GET /v1/targets` 으로 목록 → `DELETE` 루프)
- **VALIDATE**:
  - `make spk` 가 `bin/terab-agent-0.1.0.spk` 생성
  - DSM 테스트 인스턴스 (또는 본인 NAS dev 영역) 에 설치 → `synopkg status terab-agent` = running
  - 제거 시 dummy target 0 잔존 (`synowebapi --exec api=SYNO.Core.ISCSI.Target method=list` 출력 확인)

### Task 6 — fakedsm emulator (CI/로컬 테스트용)

- **ACTION**: `test/emulator/fakedsm/main.go` + `test/emulator/Dockerfile`
- **MIRROR**: agent 의 `internal/dsm/types.go` 와 동일 wire-format
- **CONTENT 가이드**:
  - fakedsm 은 `synowebapi` 와 동일 cmdline 인터페이스를 가짐 — agent 의 `execCmd` 가 PATH 에서 이걸 찾으면 그대로 동작
  - in-memory map 으로 IQN ↔ status 상태 유지
  - Dockerfile: agent 바이너리 + fakedsm 바이너리를 같은 컨테이너에 설치 + PATH 우선순위 설정
- **VALIDATE**:
  - `docker compose up storage-agent-emulator` 후 host 의 socket bind mount 로 NestJS dev 가 호출 가능
  - 통합 테스트(Task 8) 가 fakedsm 위에서 통과

### Task 7 — NestJS StorageAgentClient + Module + types + ErrorCode

- **ACTION**: `services/api/src/storage-agent/` 전체 + AppModule import + ErrorCode 4개 + env.example 갱신
- **MIRROR**: `services/api/src/twofa/` 의 module/service 구조, [services/api/CLAUDE.md §"새 모듈 생성 시 체크리스트"](../../services/api/CLAUDE.md)
- **CONTENT 가이드**:
  - `StorageAgentClient extends ServiceCore` — auto-trace
  - axios `httpAgent: new http.Agent({ socketPath: process.env.STORAGE_AGENT_SOCKET_PATH })`
  - 메서드 3개: `createTarget(req)`, `deleteTarget(iqn)`, `getTargetStatus(iqn)`. 모두 `Promise<...>` 반환 + 4xx/5xx → `ApiException('STORAGE_AGENT_*')`
  - types.ts 는 Go types.go 와 1:1 — 신규 컬럼 추가 시 양쪽 동시 수정 (Open Decisions D-A 참고)
- **VALIDATE**:
  - `npx tsc --noEmit -p services/api/tsconfig.json` 통과
  - `*.spec.ts` 통과 — axios mock 으로 4xx/5xx/network error 검증
  - `npm test --workspace=services/api -- storage-agent` 가 신규 테스트 모두 통과

### Task 8 — 통합 테스트 (NestJS → agent → fakedsm round-trip)

- **ACTION**: `services/api/test/storage-agent.e2e-spec.ts`
- **MIRROR**: 기존 `test/app.e2e-spec.ts` 의 NestJS Testing 모듈 패턴
- **CONTENT 가이드**:
  - `beforeAll`: fakedsm 을 자식 프로세스로 spawn + agent 바이너리도 spawn (tmp socket 경로)
  - 시나리오: `CreateTarget('iqn.2026-05.com.terab:test-drive-1')` → `GetTargetStatus(iqn)` = "exists" → `DeleteTarget(iqn)` → `GetTargetStatus(iqn)` → `STORAGE_AGENT_TARGET_NOT_FOUND` throw
  - `afterAll`: 두 프로세스 SIGTERM + tmp socket cleanup
- **VALIDATE**:
  - CI 에서 통과 (필요 시 Linux runner — 본 e2e 는 macOS/Windows 에선 skip)
  - `STORAGE_AGENT_E2E=1 npm run test:e2e --workspace=services/api` exit 0

### Task 9 — PRD Phase 2 row 갱신 + branch 통합 검증

- **ACTION**:
  1. PRD 의 Phase 2 row status `pending` → `in-progress` (작업 시작) → `complete` (PR 머지)
  2. PRP 컬럼: `[phase2-sidecar-agent](../plans/network-storage-reframing-phase2-sidecar-agent.plan.md)`
  3. 같은 PR 에 Phase 1 산출물(ADR-0003/0004 + 3 스키마 + 마이그레이션)도 포함되었는지 최종 확인
- **VALIDATE**:
  - `grep -n "phase2-sidecar-agent" .claude/prds/network-storage-reframing.prd.md` = 1건
  - `git log --oneline feat/storage-foundation ^v0.1` 에 Phase 1 + Phase 2 커밋 모두 등장
  - 본 plan frontmatter `status` → `done` (머지 직후)

---

## Open Decisions (Phase 2 작업 중 미세 결정)

> D1-D5 는 이미 답변 받음 (위 "Resolved Decisions" 참조). 아래는 plan 진행 중 굳혀야 하는 작은 결정들 — plan reviewer 가 답하지 않으면 권장안 그대로 진행.

| # | 결정 항목 | 권장 | 근거 |
|---|---|---|---|
| **D-A** | types.go ↔ types.ts 동기화 방식 | 수동 (본 phase) + openapi 도입 검토 (별도 PRD) | swagger codegen 도입은 별도 ADR — 본 phase 에선 단일 sidecar 1개라 수동 비용 < 자동화 비용 |
| **D-B** | IQN 명명 규칙 | `iqn.2026-05.com.terab:{drive-id}` (drive 단위) | drive_id 가 UUID 라 충돌 0 + 후속 drive 추가 시 자동 unique. Spike report 의 `iqn.2000-01.com.synology:...` 패턴과 충돌 없음 |
| **D-C** | agent 의 동시성 모델 | per-request goroutine (Go 표준 `http.Server` 기본) | synowebapi 호출은 IO bound — goroutine 100개 = OS thread 1-10개. lock 은 IQN 단위 mutex 만 |
| **D-D** | unix socket 권한 group | `terab` (신규 시스템 group) | NestJS 컨테이너 user 가 이 group 에 추가되어야 mount 가능 — docker-compose 의 `group_add: [terab]` 로 구성 |
| **D-E** | agent 로그 출력 | stdout JSON-line (`log/slog` JSONHandler) | .spk 의 start-stop-status 가 stdout 을 `/var/packages/terab-agent/var/agent.log` 로 redirect — DSM Log Center 와 호환 |
| **D-F** | 빌드 CI 위치 | GitHub Actions self-hosted runner (.spk 빌드는 Linux 필요) | 이미 runner.env.example 존재 — 동일 runner 재사용. .spk 산출물은 release artifact 로 업로드 |

---

## Validation Commands

### agent 단위 빌드/테스트
```bash
cd services/storage-agent
go mod tidy && go vet ./... && go test ./... -cover
make build-linux-amd64
make spk
```
EXPECT: 모두 exit 0. `bin/agent`, `bin/terab-agent-0.1.0.spk` 생성. 커버리지 ≥ 80%.

### NestJS 클라이언트 타입/테스트
```bash
cd services/api
npx tsc --noEmit
npm test -- storage-agent
```
EXPECT: 타입 오류 0, 단위 테스트 통과.

### 통합 테스트 (emulator 기반)
```bash
cd services/api
STORAGE_AGENT_E2E=1 npm run test:e2e -- storage-agent
```
EXPECT: round-trip 시나리오 통과.

### 스키마/agent contract 정합
```bash
# Phase 1 의 mount_credentials.iqn 컬럼이 agent IQN 명명 규칙(D-B)을 수용하는지
grep -n "iqn" services/api/src/database/schema/mount-credentials.schema.ts
# 답: varchar(255) NULL — 충분 (iqn 표기 평균 50자)
```

### 보안 검증 — agent 가 root capability 외부 누출 없음
```bash
grep -rE "(sudo|su -|setuid|setgid)" services/storage-agent/ services/api/src/storage-agent/
```
EXPECT: 0건. agent 자체가 root 로 실행되므로 추가 권한 상승 0.

### EOL 규칙 (CLAUDE.md)
```bash
file services/storage-agent/**/*.go              # ASCII (LF)
file services/storage-agent/Makefile             # ASCII (LF)
file services/storage-agent/spk/scripts/*        # ASCII (LF)
file services/api/src/storage-agent/*.ts         # CRLF
file services/storage-agent/README.md            # ASCII (LF) — Linux 배포 산출물의 일부
```

### Phase 1 + 2 통합 브랜치 검증
```bash
git log --oneline feat/storage-foundation ^v0.1
```
EXPECT: Phase 1 산출물(ADR 2개 + schema 3개 + 마이그레이션) + Phase 2 산출물(agent + client + emulator) 커밋 모두 등장.

### Manual Validation
- [ ] DSM 실 인스턴스에 .spk 설치 → `synopkg status terab-agent` = "running"
- [ ] `curl --unix-socket /var/packages/terab-agent/var/agent.sock http://localhost/healthz` 응답 `{"status":"ok"}`
- [ ] 실제 SAN Manager 에서 agent 가 생성한 dummy target 이 UI 에 보임 + agent 가 삭제하면 UI 에서 사라짐
- [ ] preuninst 가 dummy target 회수 — agent 제거 후 SAN Manager UI 에서 `terab` prefix IQN 잔존 0

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| synowebapi 의 SYNO.Core.ISCSI.* API 시그니처가 DSM 마이너 업데이트에서 변경 | M | M | API 호출을 `internal/dsm/` 한 곳에 격리 — 변경 시 wrapper 한 군데만 수정. 통합 테스트에 DSM 버전 기록 |
| .spk 설치 후 부팅 시 자동 시작 안 됨 (start-stop-status 버그) | M | H | Task 5 validation 에 "재부팅 후 status" 단계 포함. DSM 의 syslog (`/var/log/synolog/synopkg.log`) 확인 |
| socket 파일 권한 (`terab` group) 이 NestJS 컨테이너 user 와 불일치 → permission denied | M | H | docker-compose 에 `group_add: [terab]` 명시 + dev mode 에선 0666 fallback (Open Decision D-D) |
| Phase 1 schema 의 `mount_credentials.iqn` 길이(varchar 255) 가 IQN 표기에 부족 | L | M | IQN 표준 max 223 chars — varchar 255 여유. validation: Task 9 에서 schema 컬럼 확인 |
| fakedsm emulator 와 실 synowebapi 동작 drift → 통합 테스트는 통과하나 실 NAS 에서 실패 | M | H | Task 6 의 fakedsm 동작을 spike report 의 raw synowebapi 출력과 1:1 비교 검증. 신규 endpoint 추가 시 매번 동일 검증 |
| Go cross-compile 결과가 DSM 아키텍처와 불일치 (DS xxx+ 모델 = ARM vs amd64) | L | H | 본인 NAS `uname -m` 으로 사전 확인. Makefile 의 build target 을 NAS 아키텍처 default 로 |
| Phase 1 PR 과 Phase 2 PR 가 같은 브랜치에서 진행되어 마이그레이션 번호 또는 schema diff 충돌 | M | M | 같은 worktree (storage-foundation) 안에서 진행 — git 충돌은 자연 해결. PR 머지 직전 `npm run db:generate` 재실행 |
| agent 의 stdout 로그가 DSM Log Center 와 충돌 (양식 불일치) | L | L | JSON-line 양식이 DSM 의 일반 로그 파서를 망가뜨리지 않음. Log Center 통합은 Phase 7 |
| .spk 빌드 CI 가 self-hosted runner 의 root 권한 부족으로 실패 | L | M | runner 의 docker 권한만으로 빌드 가능 (alpine + go cross-compile). spk 자체는 tar.gz |

---

## Acceptance Criteria

- [ ] `services/storage-agent/` Go 모듈이 `go test ./... -cover` 통과 + 커버리지 ≥ 80%
- [ ] `make spk` 가 `bin/terab-agent-*.spk` 1개 생성
- [ ] `services/api/src/storage-agent/` 모듈이 `AppModule.imports` 에 등록 + 단위 테스트 통과
- [ ] `STORAGE_AGENT_E2E=1 npm run test:e2e` 가 emulator 기반 round-trip 통과
- [ ] DSM 실 인스턴스에 .spk 설치·실행·healthz 응답 확인 (manual)
- [ ] PRD Phase 2 row 가 `complete` + PRP 컬럼에 본 plan 경로
- [ ] `feat/storage-foundation` 브랜치에 Phase 1 + Phase 2 산출물 모두 포함된 단일 PR 머지
- [ ] 본 plan frontmatter `status` 가 `done`
- [ ] 본 PR 의 diff 에 `services/api/src/file/**`, `services/api/src/folder/**`, `services/web/**` 변경 0줄

## Completion Checklist

- [ ] root capability 가 NestJS 본체 또는 NestJS 컨테이너 user 에 부여되지 않음 — agent 만 root
- [ ] socket 파일 권한 0660 + group `terab` (production), 0666 (dev fallback)
- [ ] preuninst 가 모든 dummy target 회수 검증
- [ ] EOL 규칙: Go/Makefile/.spk script = LF, NestJS TS = CRLF
- [ ] Phase 1 schema 와 agent contract 정합 cross-review (mount_credentials.iqn, drives.mountPath 등)
- [ ] Open Decisions D-A ~ D-F 의 권장안이 코드에 반영되었거나 별도 결정으로 commit message 에 기록
- [ ] PR 본문에 "Phase 1 + Phase 2 통합 PR" 명시 + 양 phase 의 acceptance criteria 모두 체크

## Notes

- 본 plan 은 **Phase 1 plan ([phase1-sot-adr-schema](network-storage-reframing-phase1-sot-adr-schema.plan.md)) 와 같은 PR 로 머지**되도록 의도됨. 즉 같은 worktree (`.worktrees/storage-foundation/`) + 같은 브랜치 (`feat/storage-foundation`). 두 plan 의 task 는 시간상 병렬 실행 가능하나, git history 와 PR 단위는 통합.
- multi-execute 또는 multi-workflow 적용 시: Task 1-2 (agent 골격) 와 Phase 1 의 ADR-0003/0004 작성이 가장 강한 병렬 후보 — context dependency 0. Phase 1 Task 4-6 (schema 3개) + Phase 2 Task 3-4 (dsm wrapper + handler) 도 병렬 가능. Phase 1 Task 7 (마이그레이션 생성) 과 Phase 2 Task 7 (NestJS client) 는 schema → types 의존 흐름이라 순차.
- agent 의 `internal/dsm/` 가 가장 fragile 영역 — DSM 의 비공식 API 의존이라 spike report 의 raw 출력을 reference 로 항상 비교 검증. Phase 2 머지 후에도 DSM 업데이트마다 가벼운 회귀 테스트 필요 (별도 maintenance plan 후보).
- Open Decision D-A (types 동기화) 가 향후 OpenAPI codegen 도입 트리거가 될 수 있음 — 단일 sidecar 가 multi-sidecar 로 확장될 때 (예: SMB 통합 시 별도 agent 추가) 재평가. 본 phase 에선 over-engineering.

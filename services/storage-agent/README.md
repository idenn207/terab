# Terab Storage Agent

DSM 호스트에서 root 권한으로 실행되며, NestJS API 본체를 대신해 Synology SAN Manager
(iSCSI Target / LUN) 를 조작하는 sidecar 데몬.

NestJS ↔ agent 통신은 unix socket 위의 HTTP (JSON body). 인증은 socket 파일 권한
(group `terab`) 으로만 격리.

> 본 문서는 `feat/storage-foundation` 브랜치의 Phase 2 골격 (Task 1-4) 기준이다.
> .spk 빌드 (Task 5), fakedsm emulator (Task 6), NestJS client (Task 7), 통합 테스트 (Task 8)
> 는 후속 세션에서 추가된다.

---

## 디렉토리 구조

```
services/storage-agent/
├── cmd/agent/             # entrypoint (main.go)
├── internal/
│   ├── server/            # HTTP handlers + unix listener
│   ├── dsm/               # synowebapi CLI wrapper
│   └── log/               # structured JSON-line logger
├── spk/                   # Synology .spk metadata + lifecycle scripts (Task 5)
├── test/emulator/         # fakedsm — synowebapi stub for CI / local (Task 6)
├── bin/                   # 빌드 산출물 (.gitignore)
├── Makefile
└── go.mod
```

## 사전 요구사항

- Go 1.22 이상 (개발/빌드)
- DSM 7.x x86_64 또는 arm64 (운영 — 본인 NAS 아키텍처는 `uname -m` 으로 확인)
- 운영 환경에서만 `synowebapi` CLI 필요 — 로컬 dev 는 fakedsm 으로 대체 (Task 6)

## 빌드

현재 OS 용 (개발):

```bash
make build
```

DSM 타겟 (x86_64 — DS9xx+ 류):

```bash
make build-linux-amd64
```

DSM arm64 모델:

```bash
make build-linux-arm64
```

## 테스트

```bash
make vet
make test
```

커버리지 ≥ 80% 가 acceptance 기준이다 (`go test ./... -cover`).

## 로컬 디버그

```bash
make install-dev
./bin/agent -socket /tmp/terab-agent.sock -log-level debug &
curl --unix-socket /tmp/terab-agent.sock http://localhost/healthz
# → {"status":"ok"}
```

SIGTERM 시 5초 내 graceful shutdown + socket 파일 정리.

## API 표면 (Phase 2 스코프)

| Method | Path                  | 책임                   |
|--------|-----------------------|------------------------|
| GET    | `/healthz`            | liveness probe         |
| POST   | `/v1/targets`         | iSCSI target 생성       |
| GET    | `/v1/targets/{iqn}`   | target 상태 조회        |
| DELETE | `/v1/targets/{iqn}`   | target 삭제             |

요청/응답 envelope 은 NestJS `ApiException` 응답 형식과 정합:

```json
// 성공
{ "data": {...} }

// 실패
{ "error": { "code": "TARGET_CONFLICT", "message": "..." } }
```

## EOL 규칙

본 디렉토리의 모든 텍스트 파일은 LF 로 저장 (`.gitattributes` 강제).
Linux 환경에서 실행되는 산출물 (Go 바이너리, .spk script) 이라 CRLF 금지.

## 보안

- agent 자체가 root 로 실행되므로, 코드 안에서 추가 권한 상승 호출 (`sudo`, `su`,
  `setuid`) 은 금지.
- socket 파일 권한: production = `0660`, dev = `0666` fallback.
- 호출자(NestJS) 신뢰 — RBAC 는 NestJS 컨트롤러 레이어 책임 (Phase 3+).

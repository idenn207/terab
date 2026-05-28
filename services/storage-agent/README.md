# Terab Storage Agent

DSM 호스트에서 root 권한으로 실행되며, NestJS API 본체를 대신해 Synology SAN Manager
(iSCSI Target / LUN) 를 조작하는 sidecar 데몬.

NestJS ↔ agent 통신은 unix socket 위의 HTTP (JSON body). 인증은 socket 파일 권한
(group `terab`) 으로만 격리.

> NAS 배포는 [ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md) 의 결정으로
> **systemd-only** 다 — `spk/` 디렉토리는 .spk 시도 8 세션의 산출물 보존용으로 남아있지만
> 활성 빌드/배포 path 에서는 제외된다. 부활 검토 시 시작점은 `spk/` +
> [.spk session 7-8 reports](../../.claude/PRPs/reports/) 이다.

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

## NAS 배포 (systemd-only)

[ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md) 의 결정으로 NAS 배포는
systemd unit + bash install script 만 사용한다. 결정 배경(8 세션 .spk 시도 + LIO 커널 접근
요구) 은 ADR 본문 참조.

### 사전 설정 (1회)

NAS 의 `${NAS_USER}` 계정에 **sudo NOPASSWD** 설정 필요 (install script 가 password
prompt 에서 hang 되지 않도록):

```bash
ssh nas-claude  # 또는 자신의 NAS host
sudo visudo
# 다음 줄 추가 후 저장:
#   admin ALL=(ALL) NOPASSWD: ALL
# 또는 명령 단위 제한:
#   admin ALL=(ALL) NOPASSWD: /usr/bin/install, /usr/bin/systemctl, /bin/rm, /usr/bin/curl
```

추가로 SSH key 가 NAS 의 `${NAS_USER}` 에 등록되어 있어야 한다 (`ssh-copy-id` 1회).

### Install

```bash
cd services/storage-agent
NAS_HOST=nas-claude make install-agent
# 또는: NAS_HOST=nas-claude bash scripts/install-agent.sh
```

스크립트가 자동 수행:

1. `make build-linux-amd64` 산출물(`bin/agent-linux-amd64`) 사전 검증
2. sudo NOPASSWD 사전 검증
3. binary + unit 파일 `/tmp/` 경유 atomic install
4. `systemctl daemon-reload && enable --now`
5. `curl --unix-socket /run/terab-agent/agent.sock /healthz` 응답 `{"status":"ok"}` 검증
6. 환경변수 + 운영 명령 hint 출력

재실행 idempotent — 동일 명령으로 update 가능 (`scp + daemon-reload + restart`).

### 재부팅 후 자동 기동 검증

`WantedBy=multi-user.target` 으로 NAS 재부팅 시 자동 기동:

```bash
ssh nas-claude 'sudo reboot' ; sleep 60
ssh nas-claude 'systemctl is-active terab-agent'
# → active
```

### Uninstall

```bash
cd services/storage-agent
NAS_HOST=nas-claude make uninstall-agent
```

dummy target 회수 시도(`iqn.*com.terab:*` 잔존 삭제) + `systemctl disable --now` +
unit/binary 파일 정리. agent 가 이미 dead 상태여도 idempotent.

### NestJS 환경 변수

`api.env`:

```env
STORAGE_AGENT_SOCKET_PATH=/run/terab-agent/agent.sock
```

운영 NestJS 컨테이너는 NAS 의 `/run/terab-agent/` 를 bind mount 후 socket file 에
접근한다 (docker-compose 측 구성은 Phase 3 deployment 책임).

### `spk/` 디렉토리 — 보존 의의

`services/storage-agent/spk/` 와 `Makefile` 의 `.spk` 타겟은 [ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md)
T1-T3 재평가 trigger 발동 시 부활 시작점. 활성 build/배포 path 에선 호출되지 않지만
삭제하지 않는다. quarterly grooming 시 `make spk` 가 여전히 빌드 가능한지 1회 점검 권장.

---

## EOL 규칙

본 디렉토리의 모든 텍스트 파일은 LF 로 저장 (`.gitattributes` 강제).
Linux 환경에서 실행되는 산출물 (Go 바이너리, .spk script) 이라 CRLF 금지.

## 보안

- agent 자체가 root 로 실행되므로, 코드 안에서 추가 권한 상승 호출 (`sudo`, `su`,
  `setuid`) 은 금지.
- socket 파일 권한: production = `0660`, dev = `0666` fallback.
- 호출자(NestJS) 신뢰 — RBAC 는 NestJS 컨트롤러 레이어 책임 (Phase 3+).

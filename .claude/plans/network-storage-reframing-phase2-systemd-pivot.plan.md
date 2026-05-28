---
name: network-storage-reframing-phase2-systemd-pivot
description: Phase 2 systemd Pivot — storage-agent 의 NAS 배포 architecture 를 .spk → systemd-only 로 전환 (ADR-0005 의 구현 plan)
status: done
created: 2026-05-28
completed: 2026-05-29
---

# Plan: Phase 2 systemd Pivot — storage-agent 배포 architecture 전환

## Summary

[ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md) 의 결정대로 storage-agent 의 NAS 배포 path 를 .spk → systemd-only 로 전환한다. 신규 산출물 5개 (systemd unit 재배치 + install/uninstall script + Makefile target + README "Deployment" 섹션 + NestJS env 갱신). 이미 verified 된 산출물 재배치 위주이므로 **small/medium** scope. .spk 산출물(`services/storage-agent/spk/`) 은 그대로 보존 — ADR-0005 의 T1-T3 trigger 재발동 시 시작점.

## User Story

As **본인 (sole operator)**,
I want to **storage-agent 를 NAS 에 1-line make target 으로 install·update·uninstall 할 수 있고, NAS 재부팅 후 자동 기동되며, Phase 3+ 의 iSCSI target CRUD 가 LIO 커널 접근 마찰 없이 가능**,
so that **8 세션 .spk 시도의 잔존 blocker(DSM first-start abnormal) 와 Case C revisit risk(`User=root` honor 미검증) 를 sole operator 환경의 standard pattern(systemd) 으로 우회한다**.

## Problem → Solution

**현재 상태**: Phase 2 ([phase2-sidecar-agent.plan.md](network-storage-reframing-phase2-sidecar-agent.plan.md)) 가 agent 골격을 완성했으나 NAS 배포 path 는 .spk 시도 8 세션 후에도 단일 blocker(DSM `synopkg start` first-start abnormal) 미해결. OS-level systemd path 는 100% 작동 확인됨([session8 report](../PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md)).

**목표 상태**: (a) `services/storage-agent/systemd/terab-agent.service` 가 source-of-truth, (b) `NAS_HOST=... make install-agent` 가 scp + systemctl enable + healthz 검증까지 idempotent 1-command, (c) NAS 재부팅 후 `multi-user.target` 의존성 chain 으로 자동 기동, (d) socket 위치가 `/run/terab-agent/agent.sock` (systemd `RuntimeDirectory` 표준) 로 표준화 + NestJS env 갱신, (e) spk/ 디렉토리 보존 + README 에 보존 의의 명시.

## Metadata

- **Complexity**: Small/Medium — 신규 코드 5 파일(bash + systemd unit + README 갱신) + Makefile target + NestJS env. 핵심 산출물(systemd unit 본문) 은 session 8 의 verified 자산 재배치
- **Source ADR**: [ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md)
- **Parent plan**: [phase2-sidecar-agent.plan.md](network-storage-reframing-phase2-sidecar-agent.plan.md) (status `done` — 본 plan 은 그 결정 D3 의 supersede 작업)
- **Estimated Artifacts**: 8 — systemd unit + install.sh + uninstall.sh + Makefile target(루트 + service) + README 갱신 + api.env.example 갱신 + NestJS module default 갱신
- **Estimated Duration**: 1일 (script 작성 0.5일 + NAS round-trip 검증 0.3일 + NestJS env 회귀 0.2일)

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [docs/adr/0005-sidecar-agent-systemd-only.md](../../docs/adr/0005-sidecar-agent-systemd-only.md) | 본 plan 의 결정 근거. Decision 5 항목 + Mitigations 가 task 의 acceptance 기준 |
| P0 | [.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md](../PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md) §"영구 가치 — verified facts" | systemd unit 의 verified 동작. 본 plan 은 이 fact 위에 install 자동화만 추가 |
| P0 | [services/storage-agent/spk/conf/systemd/pkg-terab-agent.service](../../services/storage-agent/spk/conf/systemd/pkg-terab-agent.service) | 신규 systemd unit 의 source — `RuntimeDirectory` + socket 경로 + WantedBy 만 갱신 |
| P0 | [phase2-sidecar-agent.plan.md](network-storage-reframing-phase2-sidecar-agent.plan.md) §"Files to Create — Agent" | agent binary cross-compile 명령 (`GOOS=linux GOARCH=amd64`) — install script 가 사전 빌드 의존 |
| P1 | memory `feedback_bash_over_powershell` | install/uninstall script 는 bash (PowerShell 금지) |
| P1 | [CLAUDE.md](../../CLAUDE.md) §"새 파일 줄바꿈" | systemd unit / bash script = LF (Linux 실행 산출물) |
| P1 | [.claude/rules/ecc/common/logging.md](../../.claude/rules/ecc/common/logging.md) | install script 의 `echo` 출력은 structured (단계명 + 결과 + 다음 step 안내) — silent failure 금지 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| systemd `RuntimeDirectory` | https://www.freedesktop.org/software/systemd/man/systemd.exec.html#RuntimeDirectory= | unit 종료 시 `/run/<dir>/` 자동 정리. root:root 0755 기본 — agent 가 root 실행이라 owner 일치. systemd 211+ 지원 (DSM 7 의 219 에서 round-trip 통과 — Task 6) |
| systemd `Restart=` policy | https://www.freedesktop.org/software/systemd/man/systemd.service.html#Restart= | `on-failure` + `RestartSec=5` 가 sidecar 표준. `always` 는 SIGTERM(정상 종료) 시에도 restart → uninstall 시 race |
| `systemctl is-active` exit code | https://www.freedesktop.org/software/systemd/man/systemctl.html#is-active%20PATTERN%E2%80%A6 | active=0, inactive=3 — install script 가 health check exit code 로 판단 |
| Synology DSM 7 의 sudo NOPASSWD | DSM 7 의 admin 계정은 기본 sudo 사용. `sudo -S` 로 password 주입 가능 (memory `project_auth_2fa_fallback_pending` 시점에 검증됨) | install script 가 NAS 의 root password 를 require — `NAS_PASS` env 또는 `~/.ssh/config` 의 `RemoteCommand` |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Plan 형식 | [phase2-sidecar-agent.plan.md](network-storage-reframing-phase2-sidecar-agent.plan.md) | frontmatter + Summary/Story/Problem→Solution/Metadata/Mandatory Reading/External Doc/Patterns/Files/Tasks/Validation/Risks/Acceptance — 동일 골격, 더 작은 scope |
| bash script 톤 | [scripts/worktree-bootstrap.sh](../../scripts/worktree-bootstrap.sh) | `set -euo pipefail` + structured echo + step 별 exit code 검증 |
| Makefile target 톤 | [services/storage-agent/Makefile](../../services/storage-agent/Makefile) | env 변수 default + help target + cross-compile env 명시 |
| systemd unit 톤 | [services/storage-agent/spk/conf/systemd/pkg-terab-agent.service](../../services/storage-agent/spk/conf/systemd/pkg-terab-agent.service) | session 8 검증 본문 — `User=root` + `Restart=on-failure` 보존 |

## Files to Create / Update

### systemd 산출물 (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/storage-agent/systemd/terab-agent.service` | CREATE | LF | session 8 의 `spk/conf/systemd/pkg-terab-agent.service` 본문 + `RuntimeDirectory=terab-agent` + socket 경로 `/run/terab-agent/agent.sock` + `WantedBy=multi-user.target` |

### Install/Uninstall script (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/storage-agent/scripts/install-agent.sh` | CREATE | LF | NAS_HOST/NAS_USER env → `ssh` + `scp` 으로 binary·unit 전송 → daemon-reload + enable --now → healthz curl 검증. idempotent (재실행 시 unit 비교 후 변경 없으면 restart 생략) |
| `services/storage-agent/scripts/uninstall-agent.sh` | CREATE | LF | `systemctl disable --now` → unit + binary 삭제 → `synowebapi` 로 잔존 `iqn.*com.terab:*` target 회수 (preuninst 의 책임 이전) |

### README + Makefile 갱신

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/storage-agent/README.md` | UPDATE | LF | §"Deployment — systemd" 신설 (install/uninstall/update 절차) + 첫 문단에 "spk/ 는 ADR-0005 로 활성 path 에서 제외 — 부활 시 시작점 명시" |
| `services/storage-agent/Makefile` | UPDATE | LF | `install-agent`, `uninstall-agent` target 신설. 기존 `.spk` 타겟 보존 + comment 에 ADR-0005 link |
| `Makefile` (루트) | UPDATE | LF | `make install-agent` proxy target → `$(MAKE) -C services/storage-agent install-agent` |

### NestJS env 갱신

| File | Action | EOL | Justification |
|---|---|---|---|
| `api.env.example` | UPDATE | (보존) | `STORAGE_AGENT_SOCKET_PATH=/var/packages/terab-agent/var/agent.sock` → `/run/terab-agent/agent.sock` |
| `services/api/src/storage-agent/storage-agent.module.ts` | UPDATE | CRLF | 신규 default socket path (env 미설정 시 fallback). 누락 시 startup throw 보존 |
| `services/api/src/storage-agent/storage-agent.client.spec.ts` | UPDATE | CRLF | 신규 socket path 로 expectation 갱신. 단위 테스트 회귀 차단 |

> 본 plan 의 diff 에 `services/storage-agent/cmd/`, `internal/`, `spk/` 의 코드 변경 0줄. agent binary 자체는 Phase 2 산출물 그대로 — 본 plan 은 배포 layer 만.

## NOT Building

- **DSM Package Center UI 등록**: ADR-0005 의 결정으로 .spk path 폐기. Package Center 에서 보이지 않음 — sole operator 환경에서 의도된 trade-off
- **update 자동화 script**: install.sh 의 idempotent 재실행으로 충분. `update-agent.sh` 신설은 v1.x 백로그
- **multi-NAS 배포**: 단일 NAS 가정. multi-NAS 의 install fan-out 은 v2+
- **install script 의 fully unattended mode**: `NAS_PASS` env 주입은 dev convenience 만 — production 은 SSH key + sudo NOPASSWD 가정. password 자동화는 보안 부담
- **rollback 자동화**: uninstall 후 이전 버전 재설치 자동화는 안함. binary 파일 보존(NAS 의 `/usr/local/bin/terab-agent.bak`) 도 안함 — git tag 기반 재빌드로 충분
- **container 기반 install**: ADR-0005 의 대안 (B) Docker 폐기. 신규 도입 시 별도 ADR

---

## Step-by-Step Tasks

### Task 1 — systemd unit 신규 위치로 이전 + 경로 갱신

- **ACTION**: `services/storage-agent/systemd/terab-agent.service` 신설. `spk/conf/systemd/pkg-terab-agent.service` 의 본문 + 4가지 갱신
- **CONTENT 가이드**:
  - `[Unit]` Description="Terab Storage Agent (sidecar)" + `After=network.target`
  - `[Service]` `Type=simple`, `User=root`, `ExecStart=/usr/local/bin/terab-agent -socket /run/terab-agent/agent.sock`, `Restart=on-failure`, `RestartSec=5s`, `RuntimeDirectory=terab-agent`, `RuntimeDirectoryMode=0755`
  - `[Install]` `WantedBy=multi-user.target`
  - LF EOL (Linux 실행)
- **VALIDATE**:
  - 파일이 LF 로 저장됨 (`file services/storage-agent/systemd/terab-agent.service` 가 ASCII, CRLF 없음)
  - `systemd-analyze verify` (NAS 위에서) exit 0 — unit syntax 정상

### Task 2 — install-agent.sh 신설

- **ACTION**: `services/storage-agent/scripts/install-agent.sh` 작성. bash + `set -euo pipefail` + structured logging
- **CONTENT 가이드** (step 6개):
  1. env 확인 — `NAS_HOST`, `NAS_USER`(기본 `admin`), agent binary 존재 (`bin/agent-linux-amd64`)
  2. binary 전송 — `scp bin/agent-linux-amd64 ${NAS_USER}@${NAS_HOST}:/tmp/terab-agent`
  3. unit 전송 — `scp systemd/terab-agent.service ${NAS_USER}@${NAS_HOST}:/tmp/terab-agent.service`
  4. NAS 위 install — `ssh ${NAS_USER}@${NAS_HOST}` 으로 `sudo mv /tmp/terab-agent /usr/local/bin/` + `sudo chmod +x ...` + `sudo mv /tmp/terab-agent.service /etc/systemd/system/` + `sudo systemctl daemon-reload` + `sudo systemctl enable --now terab-agent.service`
  5. healthz 검증 — `ssh ${NAS_USER}@${NAS_HOST} 'sudo curl -sS --unix-socket /run/terab-agent/agent.sock http://localhost/healthz'` → exit 0 + 응답 `{"status":"ok"}`
  6. 결과 출력 — 성공 시 `install-agent: ok (socket=/run/terab-agent/agent.sock)`, 실패 시 step 명 + error
- **VALIDATE**:
  - `bash -n scripts/install-agent.sh` 가 syntax error 0
  - 재실행 시 idempotent (이미 install 된 상태에서 재실행 → restart 만 발생, error 0)

### Task 3 — uninstall-agent.sh 신설

- **ACTION**: `services/storage-agent/scripts/uninstall-agent.sh` 작성
- **CONTENT 가이드** (step 4개):
  1. env 확인 — `NAS_HOST`, `NAS_USER`
  2. dummy target 회수 — `ssh ... 'curl --unix-socket /run/terab-agent/agent.sock http://localhost/v1/targets' | jq -r '.[]|select(.iqn|startswith("iqn"))|.iqn' | xargs -I{} curl -X DELETE ...` (preuninst 책임 이전)
  3. systemd disable — `sudo systemctl disable --now terab-agent.service`
  4. 파일 정리 — `sudo rm -f /etc/systemd/system/terab-agent.service /usr/local/bin/terab-agent` + `sudo systemctl daemon-reload`
- **VALIDATE**:
  - 재실행 시 idempotent (이미 uninstall 된 상태 → "not installed" 보고 + exit 0)
  - 실행 후 NAS 위 `systemctl status terab-agent` = "not-found" + `/run/terab-agent/` 미존재

### Task 4 — Makefile target 신설 + README 갱신

- **ACTION**:
  - `services/storage-agent/Makefile` 에 `install-agent`, `uninstall-agent` target 추가 — install-agent 는 `build-linux-amd64` 의존 (사전 빌드 보장)
  - 루트 `Makefile` 에 `install-agent` proxy target
  - `services/storage-agent/README.md` 의 §"Deployment" 섹션 신설 — install 명령 + 환경 변수 + 재부팅 검증 절차 + spk/ 보존 의의(첫 문단)
- **VALIDATE**:
  - `make help` (있다면) 또는 `grep -E "^[a-z-]+:" Makefile` 가 `install-agent`, `uninstall-agent` 노출
  - README 의 "Deployment" 섹션이 [ADR-0005](../../docs/adr/0005-sidecar-agent-systemd-only.md) 링크 포함

### Task 5 — NestJS env 갱신 + 회귀 차단

- **ACTION**:
  - `api.env.example` 의 `STORAGE_AGENT_SOCKET_PATH` 값 갱신
  - `services/api/src/storage-agent/storage-agent.module.ts` 의 default socket path 갱신
  - `services/api/src/storage-agent/storage-agent.client.spec.ts` 의 expectation 갱신
- **VALIDATE**:
  - `npx tsc --noEmit -p services/api/tsconfig.json` exit 0
  - `npm test --workspace=services/api -- storage-agent` 통과
  - `grep -rn "var/packages/terab-agent/var/agent.sock" services/` 가 0건 (잔존 검색)

### Task 6 — 실 NAS round-trip 검증 (manual)

- **ACTION**: 본인 NAS (`nas-claude`) 에서 install → healthz → 재부팅 → 자동 기동 → uninstall round-trip
- **VALIDATE**:
  - `NAS_HOST=nas-claude make install-agent` exit 0 + healthz `{"status":"ok"}`
  - NAS 재부팅 후 `ssh nas-claude 'systemctl is-active terab-agent'` = `active`
  - `NAS_HOST=nas-claude make uninstall-agent` 후 잔존 0
  - 본 plan frontmatter `status` → `done` + ADR-0005 status `proposed` → `accepted` (PR 머지 시)

---

## Validation Commands

### install script syntax
```bash
bash -n services/storage-agent/scripts/install-agent.sh
bash -n services/storage-agent/scripts/uninstall-agent.sh
```
EXPECT: 모두 exit 0.

### systemd unit syntax (NAS 위)
```bash
ssh nas-claude 'sudo systemd-analyze verify /etc/systemd/system/terab-agent.service'
```
EXPECT: 출력 0줄 (실패 시 stderr 에 syntax error).

### NestJS 회귀
```bash
cd services/api
npx tsc --noEmit
npm test -- storage-agent
```
EXPECT: 타입 오류 0, 단위 테스트 통과.

### round-trip (실 NAS)
```bash
NAS_HOST=nas-claude make install-agent
ssh nas-claude 'sudo curl -sS --unix-socket /run/terab-agent/agent.sock http://localhost/healthz'
ssh nas-claude 'sudo reboot' ; sleep 60
ssh nas-claude 'systemctl is-active terab-agent'
NAS_HOST=nas-claude make uninstall-agent
ssh nas-claude 'systemctl status terab-agent 2>&1 | head -3'
```
EXPECT: install ok, healthz `{"status":"ok"}`, 재부팅 후 active, uninstall 후 not-found.

### 잔존 .spk 경로 검색
```bash
grep -rn "var/packages/terab-agent" services/ .claude/ docs/ 2>&1 | grep -v "^Binary"
```
EXPECT: ADR-0005 / phase2-systemd-pivot plan / session8 report 외 0건 (.spk path 가 활성 코드에 잔존하지 않음).

### EOL 규칙
```bash
file services/storage-agent/systemd/*.service     # ASCII (LF)
file services/storage-agent/scripts/*.sh          # ASCII (LF)
file services/storage-agent/README.md             # ASCII (LF)
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NAS 의 sudo NOPASSWD 미설정 → install script 가 password prompt 에서 hang | M | M | install.sh 가 `sudo -n true` 사전 검증 → 실패 시 명확한 error message + README 의 "사전 설정" 섹션에 NOPASSWD 가이드 |
| systemd `RuntimeDirectory` 가 NAS 의 systemd 버전에서 미지원 | L | H | session 8 의 verified systemd 동작이 `RuntimeDirectory` 지원 systemd 240+. DSM 7.2 의 systemd 가 240+ — Task 1 validate 의 `systemd-analyze verify` 가 사전 차단 |
| socket 경로 변경 후 NestJS dev 환경의 socket bind path 불일치 | M | M | Task 5 의 `api.env.example` + dev compose path 동시 갱신. `grep -rn "var/packages/terab-agent/var/agent.sock" services/` 가 0건 검증 |
| 재부팅 후 자동 기동 실패 (`multi-user.target` 의존성 누락) | L | H | Task 6 의 manual round-trip 이 검증. 실패 시 unit `After=` 에 `network-online.target` 추가 후 재검증 |
| .spk 산출물(spk/) 가 코드 회전에서 stale 화 → ADR-0005 의 T1-T3 trigger 시 시작점 가치 손실 | M | L | README 첫 문단의 보존 의의 명시 + quarterly grooming 시 `cd services/storage-agent && make spk` 1회 점검을 운영 routine 에 포함 |
| install script 의 idempotency 누수 → 재실행 시 unit 중복 enable 또는 binary race | L | M | Task 2 의 step 4 가 `systemctl is-enabled` 사전 확인 + 변경 없으면 restart 만. binary 전송은 `scp -a` 가 아닌 atomic move (`mv /tmp/... /usr/local/bin/...`) |
| uninstall 의 dummy target 회수가 healthz 미응답 상태에서 hang | L | M | Task 3 의 step 2 가 timeout (`curl --max-time 5`) + healthz 사전 확인. agent 가 이미 dead 면 skip + warn |

---

## Acceptance Criteria

- [x] `services/storage-agent/systemd/terab-agent.service` 생성 + `systemd-analyze verify` 통과 (DSM 7 systemd 219 에서 load + active 확인 — `systemd-analyze verify` CLI 자체는 219 에 부재이나 unit 실 적재가 더 강한 검증)
- [x] `services/storage-agent/scripts/install-agent.sh` + `uninstall-agent.sh` 생성 + `bash -n` 통과 + idempotent
- [x] `services/storage-agent/Makefile` 의 `install-agent` / `uninstall-agent` target 작동
- [x] 루트 `Makefile` 의 `install-agent` proxy target 작동
- [x] `services/storage-agent/README.md` §"Deployment — systemd" 섹션 + spk/ 보존 의의 명시
- [x] `api.env.example` 의 `STORAGE_AGENT_SOCKET_PATH` 갱신
- [x] NestJS storage-agent 모듈 단위 테스트 통과 (회귀 0)
- [x] 실 NAS round-trip 통과 — install / healthz / 재부팅 / 자동 기동 / uninstall (2026-05-29, [Phase 5 report](../PRPs/reports/network-storage-reframing-phase2-systemd-pivot-task6-report.md))
- [ ] ADR-0005 frontmatter `status` `proposed` → `accepted` + PR 번호 + 머지일 (PR 머지 시점)
- [x] 본 plan frontmatter `status` `in-progress` → `done` (Task 1-6 완료 시점)

## Completion Checklist

- [ ] spk/ 디렉토리 + Makefile 의 `.spk` 타겟이 그대로 보존됨 (삭제 0)
- [ ] EOL 규칙: systemd unit / bash script / README = LF, NestJS TS = CRLF, env.example = (기존 보존)
- [ ] grep 으로 `var/packages/terab-agent/var/agent.sock` 잔존 0 (ADR / plan / session report 제외)
- [ ] PR 본문에 "ADR-0005 의 구현 + Phase 2 systemd-pivot" 명시 + acceptance criteria 모두 체크
- [ ] commit message 첫 줄: `feat(storage-agent): NAS 배포 systemd-only 전환 (ADR-0005)` 형식

## Notes

- 본 plan 은 [phase2-sidecar-agent.plan.md](network-storage-reframing-phase2-sidecar-agent.plan.md) 와 **같은 브랜치** (`feat/storage-foundation`) 에서 진행. PR 단위는 별도 가능 — Phase 2 본체와 systemd pivot 을 한 PR 로 묶을지, 분리 PR 로 갈지는 worktree 의 현재 commit 분포(이미 .spk fix commit 1개 + Phase 2 본체 1개) 와 무관하게 *본 plan 완료 시점에 단일 PR* 로 처리하는 것을 권장
- session 7-8 의 .spk research 자산은 영속 — 본 plan 머지 후에도 spk/ 디렉토리·session report·Makefile `.spk` 타겟이 모두 살아있어 [ADR-0005 §"재평가 trigger"](../../docs/adr/0005-sidecar-agent-systemd-only.md) T1-T3 시 시작점
- 본 plan 의 후속(Phase 3 web 콘솔 발급 UI) 은 socket 경로 변경의 영향만 검증하면 됨 — NestJS client 의 메서드 시그니처는 본 plan 으로 불변
- install script 의 sudo password 처리는 본 plan 에서 정공법(SSH key + NOPASSWD)만 다룸. `NAS_PASS` env 자동 주입은 dev convenience 라도 본 plan 범위 밖 — 별도 needs assessment

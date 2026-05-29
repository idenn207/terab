---
name: sidecar-agent-systemd-only
description: storage-agent 의 NAS 배포 architecture 를 DSM .spk 에서 systemd-only 로 전환한다 — Phase 3+ 의 LIO 커널 접근 요구·sole operator 환경의 운영 패턴·8 세션 .spk 시도의 잔존 blocker(DSM first-start abnormal) 종합 판단
status: accepted
date: 2026-05-28
accepted_date: 2026-05-29
---

# ADR-0005: storage-agent 배포 architecture — DSM .spk 폐기, systemd-only 채택

## Status

accepted — PR [#63](https://github.com/idenn207/terab/pull/63) 머지 (2026-05-29). 실 NAS round-trip 통과 + DSM 7 환경 4건 차이 보정 완료.

## Context

[ADR-0003](0003-storage-sot-nas-filesystem.md) 가 storage SoT 를 NAS filesystem 으로 이전했고, [Phase 2 plan](../../.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md) 이 Go `storage-agent` sidecar 의 골격(binary + unix socket + synowebapi wrapper)을 완성했다. 본 ADR 은 그 agent 를 **NAS 에 배포하는 방식** 에 대한 architecture 결정이다.

Phase 2 plan §"Resolved Decisions" 의 **D3** 는 배포 방식을 "Synology .spk 공식 패키지" 로 답했었다. 근거는 (a) 부팅 자동 시작, (b) DSM Package Center 의 가시적 관리, (c) host namespace 직접 실행. 본 ADR 은 그 D3 를 폐기하고 **systemd-only** 로 대체한다.

### 결정 배경 — .spk 시도의 8 세션 데이터

.spk 배포 시도는 session 1-8 ([Phase 2 Task 5-9 후속](../../.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md)) 에서 누적 ~$70+ 의 비용으로 다음을 확인했다:

- ✅ unsigned 3rd-party .spk install wall 통과 (`start_as_root="no"` + minimal `privilege.json` 조합)
- ✅ DSM 이 install 시점에 `conf/systemd/*.service` 를 `/usr/local/lib/systemd/system/` 으로 복사 + `pkgctl-<pkg>.service` 의 WantedBy chain 작동
- ✅ `sudo systemctl start pkgctl-terab-agent.service` 의 OS-level path 가 healthz `{"status":"ok"}` round-trip 100% 작동
- ❌ DSM `synopkg start` 의 first-start 시점에 `"failed to stop abnormal package"` 차단 — fresh install + uninstall+reinstall 모두 동일
- ❌ postinst hook 의 `systemctl enable` 이 `Access denied` — privilege.json 의 `defaults.run-as: package` 가 install hook 까지 적용 (session 7 가설 H1 폐기)

자세한 evidence 는 [session8-report](../../.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md) §"검증된 evidence" 참조.

### 결정에 영향을 준 architecture 요구

- **Phase 3+ 의 LIO 커널 접근**: [ADR-0004](0004-iscsi-priority-smb-deferred.md) 의 iSCSI target CRUD 는 `/sys/kernel/config/target/` 쓰기 = root 권한 필요. .spk path 는 systemd unit `User=root` 가 DSM 에서 honor 되는지 미검증 상태 — session 8 report 의 Case C 시나리오(추가 architectural revisit) 가 잔존 risk
- **운영자 = sole operator**: 본 프로젝트는 1인 운영. DSM Package Center 의 다중 admin 통제 가치 미발동. SSH + `systemctl` 이 이미 daily driver
- **systemd path 가 이미 verified**: session 8 의 가장 큰 자산. .spk 를 폐기해도 핵심 runtime path 는 무손실 — *위치만 이전*

### 검토된 대안

| 대안 | 남은 비용 | 운영 부담 | Phase 3+ 연결성 | 채택 여부 |
|---|---|---|---|---|
| **(A) .spk 계속** (H4-H7 가설 검증) | ~$5-10 / worst $30+ (Case C) | DSM Web UI 통제 (최상) + first-start 시 1-3 line manual step | ⚠️ `User=root` honor 미검증 (잔존 risk) | ❌ |
| **(B) Docker** (privileged + host kernel mount) | ~$10-20 (`--privileged` + LIO host bind + DSM Container Manager privileged 허용 검증) | docker-compose 별도 운영 (Swarm 합류 불가) | ⚠️ DSM 7 Container Manager 의 privileged 정책 미검증 | ❌ |
| **(C) systemd-only** | ~$2-5 (install script + Makefile target + README 갱신) | SSH + `systemctl` (sole operator 환경 daily driver) | ✅ `User=root` 직접 실행, LIO/targetcli 접근 자유 | ✅ |

본 ADR 의 가치: 채택 그 자체보다 **재시도 dead-end 의 영속화** + Phase 3+ blocker 의 사전 차단 + .spk 매몰비용의 명시적 보존(spk/ 디렉토리 + session report).

## Decision

storage-agent 의 NAS 배포를 **systemd-only** 로 전환한다. 적용 디테일:

1. **신규 산출물 위치** (모두 LF):
   - `services/storage-agent/systemd/terab-agent.service` — systemd unit (session 8 의 검증된 `spk/conf/systemd/pkg-terab-agent.service` 내용 + `RuntimeDirectory=terab-agent` 추가 + socket 경로 변경)
   - `services/storage-agent/scripts/install-agent.sh` — bash, root SSH 위에서 실행. `scp` agent binary + unit 파일 + `systemctl daemon-reload && systemctl enable --now`
   - `services/storage-agent/scripts/uninstall-agent.sh` — 역작업 + dummy target 회수
   - `services/storage-agent/README.md` §"Deployment — systemd" — onboarding 절차 박제 + `spk/` 보존 의의 명시

2. **socket 경로 변경**: `/var/packages/terab-agent/var/agent.sock` (.spk 표준) → `/run/terab-agent/agent.sock` (systemd `RuntimeDirectory` 표준 — root:root 0755 자동 생성·정리). NestJS env `STORAGE_AGENT_SOCKET_PATH` 갱신.

3. **systemd unit 핵심**:
   - `User=root` (LIO 커널 접근)
   - `ExecStart=/usr/local/bin/terab-agent -socket /run/terab-agent/agent.sock`
   - `Restart=on-failure`, `RestartSec=5s`
   - `RuntimeDirectory=terab-agent` (= `/run/terab-agent/` 자동 생성)
   - `[Install] WantedBy=multi-user.target` (.spk 의 `pkgctl-*.service` WantedBy 와 달리 표준 target)

4. **operator onboarding**: `NAS_HOST=nas-claude make install-agent` — install-agent.sh 를 wrap. 단일 명령 idempotent.

5. **.spk 산출물 처리**: `services/storage-agent/spk/` 디렉토리 + Makefile 의 `.spk` 타겟 모두 **그대로 보존**. 본 ADR 은 그것을 *현재 빌드/배포 path 에서 제외* 할 뿐 산출물을 삭제하지 않는다 — 미래 패키지화 결정 번복 시 시작점. `services/storage-agent/README.md` 의 첫 줄에 보존 의의 명시.

### .spk path 재평가 trigger

다음 중 하나가 만족되면 새 ADR(ADR-0006+) 로 .spk 복귀를 평가한다:

- **(T1) 다중 사용자 배포 필요** — terab 을 본인 외 운영자가 NAS 패키지로 설치하는 use case 발생 (예: 가족 1인이 본인 NAS 에 별도 인스턴스 운영)
- **(T2) DSM Web UI 통제 요구** — sole operator 가정이 깨져서 enable/disable/restart 을 GUI 로 제어해야 함
- **(T3) Synology 의 unsigned package 정책 완화** — DSM 의 first-start abnormal 차단 mechanism 이 공식 변경되거나 sign 발급 경로가 열림 (Synology developer announcement 추적)

T1-T3 중 하나라도 만족되면 시작점은 `services/storage-agent/spk/` + [session 7~8 report](../../.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md). 본 ADR 의 가장 큰 가치 중 하나가 그 시작점의 영속화.

## Consequences

### Positive

- **Phase 3+ blocker 사전 제거** — agent 가 `User=root` 로 직접 실행 → LIO `/sys/kernel/config/target/` 접근 자유. Case C revisit risk 0
- **남은 비용 최소** — agent binary + systemd unit 은 이미 verified. 신규 산출물은 install script + Makefile target + README 갱신 = ~$2-5
- **운영 부담이 daily driver 와 정합** — SSH + `systemctl` 이 이미 본인 daily — DSM Web UI 통제 부재는 sole operator 환경에서 미미한 손실
- **session 7-8 의 검증된 systemd unit 무손실** — `spk/conf/systemd/pkg-terab-agent.service` 의 본문 그대로 이전. 추가 NAS 검증은 1-line socket 경로·RuntimeDirectory 변경 회귀만
- **명시적 재평가 trigger** — T1-T3 박제로 ".spk 폐기 = 잊혀짐" 회피
- **단일 NAS 환경의 단순성** — DSM Package Center 와 systemd 의 이중 통제 channel 이 하나로 통일 → 운영 사고 시 디버그 surface 절반

### Negative

- **DSM Package Center 통제 0** — start/stop/status 가 SSH 로만 가능. 다중 admin 환경에서는 마찰. v1 sole operator 환경에선 미발동
- **부팅 자동 시작이 systemctl enable 에 의존** — install script 의 `systemctl enable --now` 누락 시 NAS 재부팅 후 agent 미기동. install script 의 idempotent 검증 필수
- **update flow 가 SSH 기반** — `scp + systemctl restart` 매뉴얼. DSM Package Center 의 "버전 업데이트" UI 없음. v1.x 에서 update 자동화 script 추가 검토
- **session 7-8 의 .spk research 산출물이 활성 path 에서 제외** — Makefile 의 `.spk` 타겟, `INFO.tmpl`, `privilege`, `postinst`, `start-stop-status` 가 현재 build path 에 미참여. 매몰비용의 명시적 보존(spk/ 디렉토리 + Makefile 타겟 유지)은 의의 — 다만 코드 회전에서 stale 화 위험
- **socket 경로 변경의 NestJS 영향** — `STORAGE_AGENT_SOCKET_PATH` env 변경 + `api.env.example` + dev compose 경로 영향. 회귀 risk
- **재부팅 검증 부담 발생** — `WantedBy=multi-user.target` 의 실 NAS 재부팅 round-trip 확인이 acceptance 의 manual 단계 1개 추가

### Mitigations

- **install script 의 idempotent + 자동 검증** — install.sh 가 install 직후 `systemctl is-enabled` + `curl --unix-socket /run/terab-agent/agent.sock http://localhost/healthz` 검증 + exit code 로 명시적 성공/실패 보고. 부팅 자동 시작 누락 사전 차단
- **update script 검토 (v1.x)** — `scripts/update-agent.sh` 신설은 v1.x 백로그. 현재는 install-agent.sh 가 idempotent 라 재실행으로 update 가능 (binary 교체 → daemon-reload 미필요 / unit 변경 시에만 reload)
- **spk/ 의 stale 화 방지** — `services/storage-agent/README.md` 의 "Deployment" 섹션 첫 줄에 "spk/ 는 ADR-0005 로 활성 path 에서 제외됨. .spk 부활 검토 시 spk/ + session 7-8 report 부터 시작" 명시. quarterly grooming 시 spk/ 빌드 가능 여부 1회 점검
- **socket 경로 변경 회귀 차단** — Phase 2 의 `storage-agent.client.spec.ts` + e2e 가 신규 경로로 통과하는지 확인. env 누락 시 명확한 error message (`STORAGE_AGENT_SOCKET_PATH not set` throw at module bootstrap)
- **Phase 3 web 콘솔 contract 보존** — socket path 가 변해도 NestJS client 인터페이스(메서드 시그니처) 는 불변. Phase 3 의 API contract 영향 0
- **재부팅 검증의 manual 단계** — install-agent.sh 의 README 절차에 "NAS 재부팅 1회 → `systemctl is-active` 확인" 을 acceptance step 으로 명시. Phase 2 의 Task 5 validation 과 동일 시간대 검증

## References

- **선행 PRD**: [.claude/prds/network-storage-reframing.prd.md](../../.claude/prds/network-storage-reframing.prd.md) §"Technical Approach"
- **superseded decision**: [Phase 2 sidecar plan](../../.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md) §"Resolved Decisions" D3 — "Synology .spk 공식 패키지"
- **결정 배경 evidence (8 세션 .spk 시도 누적)**:
  - [session8 report](../../.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session8-report.md) — install wall 통과 + DSM first-start blocker 발견
  - [session7 report](../../.claude/PRPs/reports/network-storage-reframing-phase2-sidecar-agent-task5-9-session7-report.md) — architectural pivot 설계
- **본 ADR 의 구현 plan**: [.claude/plans/network-storage-reframing-phase2-systemd-pivot.plan.md](../../.claude/plans/network-storage-reframing-phase2-systemd-pivot.plan.md)
- **선행 ADR (iSCSI 우선 — LIO 접근 요구의 출처)**: [ADR-0004](0004-iscsi-priority-smb-deferred.md)
- **선행 ADR (Storage SoT 이전 — 본 architecture chain 의 시작)**: [ADR-0003](0003-storage-sot-nas-filesystem.md)
- **검증된 systemd unit 원본**: `services/storage-agent/spk/conf/systemd/pkg-terab-agent.service` (Phase 2 systemd-pivot plan Task 1 에서 신규 위치로 이전)
- **systemd `RuntimeDirectory` 표준**: https://www.freedesktop.org/software/systemd/man/systemd.exec.html#RuntimeDirectory=

---
status: in-progress
started: 2026-05-26
related-prd: ../../.claude/prds/network-storage-reframing.prd.md
related-plan: ../../.claude/plans/network-storage-reframing-phase0-spike.plan.md
---

# Phase 0 Spike — Steam on iSCSI / SMB

> 가설: **본인이 NAS에 설치한 Steam 게임을 한 달 이상 불편 없이 플레이한다.**
> 본 spike 의 목표 = 코드 0줄로 가설이 기술적으로 가능한지를 매뉴얼 검증.
> Pass/Fail 기준은 plan 의 Decision Gate 표를 그대로 따른다.

## Pre-Spike Open Decisions

| TBD | 선택 | 비고 |
|---|---|---|
| TBD-7 spike 게임 | `<fill in>` (예: Stardew Valley — single-player) | Anti-Cheat 미사용 게임을 1차 통과용으로 권장 |
| TBD-8 우선 트랙 | iSCSI 먼저 | block-level mount 가 가설의 본질에 가까움 |
| TBD-9 라이센스 | 본인 기존 Steam 라이브러리 | cost 0 |

## Baseline

> 마운트 위 측정치의 천장. 이 값보다 마운트 측정치가 빠를 수 없다.
> 측정 시각 + 동시 IO (RAID rebuild / 백업) 유무를 함께 기록.

### NIC throughput (iperf3)

명령:
```bash
iperf3 -c <nas-ip> -t 30 -P 4
iperf3 -c <nas-ip> -t 30 -P 4 -R   # reverse direction
```

| 방향 | 측정값 (MB/s) | 비고 |
|---|---|---|
| client → NAS | `<fill in>` | 기대 ~240 MB/s @ 2.5 GbE |
| NAS → client (-R) | `<fill in>` | |

### 로컬 디스크 (NAS 호스트 안, fio script)

명령:
```bash
bash docs/spikes/scripts/fio-baseline.sh /srv/spike-baseline
```

Raw output:
```
<paste 3 workloads here verbatim>
```

| 워크로드 | 측정값 | 비고 |
|---|---|---|
| seq read 1M | `<fill in> MB/s` | 기대 ≥ 100 |
| random 4K read | `<fill in> IOPS` | 기대 ≥ 500 |
| seq read warm (2nd pass) | `<fill in> MB/s` | 1st pass 대비 delta = L2 cache 효과 |

### 동시 IO 확인

- [ ] 측정 시점에 RAID rebuild 진행 중 아님 (`cat /proc/mdstat` 확인)
- [ ] 백업/스냅샷 작업 비활성 (`iotop -o` 로 ≥10MB/s 작업 0건)

---

## Track A — iSCSI

> setup 매 단계 직후 `targetcli ls` 로 트리 확인. `saveconfig` 잊으면 재부팅 시 증발.

### Setup 로그 (NAS, root)

```
<paste targetcli 명령 sequence + 출력 요약>
```

체크:
- [ ] `/backstores/block` 에 `spike0` 보임
- [ ] `/iscsi/iqn.2026-05.local.terab:spike0` 트리 생성
- [ ] ACL 에 Windows initiator IQN 등록
- [ ] `saveconfig` 호출 + `/etc/rtslib-fb-target/saveconfig.json` 갱신 확인

### Windows mount

- [ ] iSCSI Initiator → Discovery 에 NAS IP:3260 등록
- [ ] Target `spike0` connected (Restore on boot ✓)
- [ ] `diskmgmt.msc` 에서 새 디스크 → GPT → NTFS (allocation unit 64K) → Z:

### 측정 (Windows fio script)

명령:
```powershell
.\docs\spikes\scripts\fio-baseline.ps1 -DriveLetter Z
```

Raw output:
```
<paste 3 workloads here>
```

| 워크로드 | 측정값 | baseline 대비 비고 |
|---|---|---|
| seq read 1M | `<fill in> MB/s` | |
| random 4K read | `<fill in> IOPS` | |
| seq read warm | `<fill in> MB/s` | |

---

## Track B — SMB

> SMB 자격증명은 **평문 기록 금지** — 1Password 항목 참조로만 표기.

### Setup 로그 (NAS, root)

```
<paste smb.conf [spike0] section + useradd + pdbedit 명령>
```

체크:
- [ ] `pdbedit -L` 에 `spike` 사용자 보임
- [ ] `/srv/spike0` 디렉토리 + `spike:spike` 소유권
- [ ] `smbclient -L //<nas-ip> -U spike` 로 share 보임
- [ ] 자격증명은 1Password 항목 `nas-spike-smb` 에 저장 (이 문서에는 평문 미기록)

### Windows mount

```powershell
# 자격증명은 매개변수로 전달하지 말고 net use 가 프롬프트하게 두기
net use Z: \\<nas-ip>\spike0 /user:spike * /persistent:yes
```

### 측정

명령:
```powershell
.\docs\spikes\scripts\fio-baseline.ps1 -DriveLetter Z
```

Raw output:
```
<paste 3 workloads here>
```

| 워크로드 | 측정값 | iSCSI 대비 비고 |
|---|---|---|
| seq read 1M | `<fill in> MB/s` | |
| random 4K read | `<fill in> IOPS` | |
| seq read warm | `<fill in> MB/s` | |

### 정리 (측정 종료 후)

```powershell
net use Z: /delete
```

---

## Steam Workload

게임: `<fill in>` (TBD-7 결정값)
트랙: `<iSCSI | SMB>` (fio 결과 우월한 쪽)
설치 경로: `Z:\SteamLibrary\steamapps\common\<game>`

### 첫 실행

- [ ] Steam 라이브러리 위치에 Z: 추가
- [ ] 게임 설치 완료 — `Z:\SteamLibrary\steamapps\common\<game>` 존재 확인
- [ ] 첫 실행 → 메인 메뉴 진입 (`<fill in> 초`)
- [ ] 5분 인게임 플레이 — 크래시 0회, Anti-Cheat 차단 0회

첫 실행 결과 1줄: `<Pass | Fail — 이유>`

---

## Daily Play Log

> 매일 30~60분 플레이 후 즉시 기록. 마지막 날 (Day 7) Decision Gate 채움.

| date | session_min | dropouts | load_main_sec | load_ingame_sec | fps_floor | anticheat_blocks | dmesg_errors | note |
|---|---|---|---|---|---|---|---|---|
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |
| 2026-MM-DD | | | | | | | | |

dmesg 수집:
```bash
sudo journalctl -k --since "1 hour ago" | grep -iE "iscsi|samba|target|tcm" >> dmesg-spike.log
```

---

## Decision

### Decision Gate 평가

| 항목 | 기준 | 실측 | Pass/Fail |
|---|---|---|---|
| Steam 게임 첫 실행 | 메인 메뉴 + 5분 플레이 | `<fill in>` | |
| 7일 단기 무탈 플레이 | 끊김 ≤ 1회/주 + 크래시 0 | `<fill in>` | |
| Seq read throughput (mount) | ≥ 100 MB/s | `<fill in> MB/s` | |
| Random 4K IOPS (mount) | ≥ 500 | `<fill in> IOPS` | |
| 마운트 자동 재연결 | 재부팅 후 자동 마운트 성공 | `<fill in>` | |

### Go / No-Go

**판정**: `<Go | No-Go>`

**근거 (1 단락)**:
> `<fill in>` — 5개 항목 중 N개 Pass, Steam 첫 실행은 Pass/Fail, 따라서 ...

### PRD TBD 응답

- **TBD-1 (SMB vs iSCSI 우선)**: `<fill in>` — 근거: `<측정 결과 1줄>`
- **TBD-5 (병목 위치)**: `<NIC | HDD | Client | balanced>` — 근거: baseline vs mount 측정치 비교

### 후속 액션

- [ ] PRD Phase 0 row status → `complete` + Pass/Fail 결과 1줄 추가
- [ ] Go 판정 시: Phase 1 (Storage SoT ADR) + Phase 2 (sidecar) 병렬 착수
- [ ] No-Go 판정 시: PRD frontmatter status → `superseded` + 새 PRD draft 트리거
- [ ] spike 자원 정리: `targetcli /iscsi delete iqn.2026-05.local.terab:spike0`, `pdbedit -x spike`, `rm -rf /srv/spike0`, 테스트 데이터 삭제
- [ ] 30일 백그라운드 검증 시작 — 끊김/크래시 누적 시 phase 1+ 일시중단 + retrospect

---

## Completion Checklist

- [ ] 평문 secret/password 0건 (`grep -i password docs/spikes/phase0-*.md` → placeholder 또는 0건)
- [ ] EOL 규칙 준수: 본 파일 CRLF, fio-baseline.sh LF, fio-baseline.ps1 CRLF
- [ ] 동일 spike 재현 가능할 정도로 상세
- [ ] TBD-1, TBD-5 답이 명시됨
- [ ] No-Go 시 후속 트리거 (PRD reframe) 명확

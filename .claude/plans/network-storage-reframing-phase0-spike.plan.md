---
name: network-storage-reframing-phase0-spike
description: Phase 0 — 코드 작성 전 Steam-on-iSCSI/SMB 수동 spike + fio baseline + 가설 사망 조기 탐지
status: pending
created: 2026-05-25
---

# Plan: Phase 0 — Steam-on-iSCSI / SMB Spike

## Summary

NestJS·schema·UI 코드를 한 줄도 쓰기 전에, 호스트 OS에서 iSCSI(LIO) 또는 SMB(Samba) target 을 **수동 설정**하고 Windows PC에서 마운트해 **실제 Steam 게임 1개를 30일간 무탈 플레이**할 수 있는지 검증한다. 동시에 `fio` baseline 으로 100MB/s seq read 달성 가능 여부와 병목 위치를 측정. 한 가지라도 실패 시 [network-storage-reframing PRD](../prds/network-storage-reframing.prd.md) 자체를 재정의한다.

## User Story

As **본인 (operator + power user)**,
I want to **코드 투자 전에 가설(Steam-on-NAS)이 기술적으로 가능한지를 매뉴얼로 확인**,
so that **불가능한 가설에 phase 1~7 매몰 비용을 쏟지 않고, PRD 를 빨리 폐기·재정의할 수 있다**.

## Problem → Solution

**현재 상태**: PRD 가설("Steam 30일 무탈 플레이")이 **검증 안 됨**. iSCSI/SMB 위에서 Steam Anti-Cheat·DRM·파일 락이 실제로 동작하는지, 2.5GbE+RAID5+L2-cache 구성에서 100MB/s 가 어디서 막히는지 미측정.

**목표 상태**: (a) Steam 1게임 실제 실행 + 일주일 무탈 플레이 로그 확보, (b) `fio` baseline 으로 NIC/HDD/Client 중 병목 위치 식별, (c) iSCSI vs SMB 중 phase 1+ 에서 우선 통합할 프로토콜에 대한 데이터 기반 결정 — 모두 코드 0줄로.

## Metadata

- **Complexity**: Small (코드 변경 없음 — 호스트 설정 + 수동 측정 + 문서화)
- **Source PRD**: [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md)
- **PRD Phase**: Phase 0 — Spike: Steam-on-iSCSI 사전 검증
- **Estimated Artifacts**: 3 — spike report 1, fio script 2 (Linux + Windows), decision memo in report
- **Estimated Duration**: 1주 (setup 1일 + 측정 1일 + 게임 플레이 7일 + 보고 1일). 30일 무탈 검증은 phase 0 종료 후에도 백그라운드 지속.

---

## UX Design

N/A — 이 phase 는 사용자 대상 UI 변경이 없는 **내부 검증 활동**. 단, 본인 시점에서의 절차 UX(아래 "Spike Protocol")는 향후 phase 3 의 web 콘솔 발급 UX 의 reference 가 된다.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md) | 가설 정의, success metric, TBD 목록 |
| P0 | PRD Risk 표 row 1 (Anti-cheat 거부), row 2 (RAID5 throughput) | 이 spike 가 사후적으로 검증하려는 정확한 risk |
| P1 | PRD TBD-1 (SMB vs iSCSI 우선) + TBD-5 (병목 위치) | 이 spike 의 output 이 두 TBD 를 닫는다 |
| P2 | [CLAUDE.md](../../CLAUDE.md) — "새 파일 줄바꿈" 규칙 | spike report (Windows 편집) = CRLF, fio shell script (NAS Linux 실행) = LF |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| LIO / targetcli (Linux iSCSI target) | `man targetcli` + Red Hat Storage Admin Guide | `backstores/fileio` 또는 `backstores/block` → `iscsi/<iqn>/tpg1/luns` 로 export. fileio 가 단순하나 block(LVM/raw) 이 일반적으로 빠름 |
| Samba 4 share + `force user` | `man smb.conf`, `man pdbedit` | `[share]` + `path` + `valid users` + `read only = no`. 단일 사용자 spike 는 `pdbedit -a` 로 standalone user 생성 |
| Windows iSCSI Initiator | `iscsicli` / GUI | 자동 재연결 옵션 필수, MPIO 는 spike 에선 불필요 |
| `fio` 표준 워크로드 | `man fio` + Jens Axboe README | `--rw=read --bs=1M --iodepth=32` (seq), `--rw=randread --bs=4k --iodepth=64` (random IOPS) |
| Steam 라이브러리 위치 추가 | Steam 공식 docs | Library Folders → Add → 마운트된 드라이브 letter. ACF 파일이 그 위치에 생성되어야 함 |

---

## Spike Protocol

### Pre-Spike Baseline (코드/마운트 없는 상태)

순서대로 측정해 **client ↔ NAS 사이 네트워크 자체의 한계** 를 먼저 알아내야 한다 — 그렇지 않으면 마운트 위 측정치가 "마운트 오버헤드" 인지 "네트워크 한계" 인지 구분 불가.

1. **NIC throughput**: `iperf3 -c <nas-ip> -t 30 -P 4` (양방향 `-R` 도 측정). 기대값: 2.5 GbE = ~280 MB/s 이론치, 실용 240~260 MB/s
2. **로컬 디스크 raw (NAS 호스트 안에서)**: `fio --name=local --filename=/path/on/raid5/test.bin --rw=read --bs=1M --size=4G --iodepth=32 --runtime=30 --group_reporting`
3. **로컬 디스크 random 4K**: 위와 동일 + `--rw=randread --bs=4k --iodepth=64`
4. **L2 cache (SSD RAID1) 효과 확인**: 같은 4G 파일을 두 번 연속 측정 — 두 번째가 유의미하게 빠르면 cache 가 동작

세 측정치 모두 phase 0 report 의 baseline 섹션에 기록. **이 baseline 보다 마운트된 디스크 측정치가 더 빠를 수 없다** = 가능한 천장 확인.

### Track A — iSCSI (LIO) 경로

**Setup (NAS 호스트, Linux, root)**:

1. `targetcli` 설치 확인 — `which targetcli || apt install targetcli-fb`
2. backstore 생성 — `/backstores/block create name=spike0 dev=/dev/<vg>/<lv>` (raw block 권장, fileio 는 fallback)
3. iSCSI target 생성 — `/iscsi create iqn.2026-05.local.terab:spike0`
4. LUN export — 자동 생성된 tpg1 안에서 `luns/ create /backstores/block/spike0`
5. ACL 또는 CHAP — spike 단계에선 ACL only: `acls/ create iqn.1991-05.com.microsoft:<windows-hostname>` (Windows iSCSI Initiator 의 IQN 확인 후 입력)
6. `saveconfig` → `/etc/rtslib-fb-target/saveconfig.json` 영속화 확인

**Windows client**:

1. `iscsicli` 또는 "iSCSI Initiator" GUI → Discovery 탭에 NAS IP:3260 등록
2. Targets 탭에서 spike0 connect (Restore on system boot 체크)
3. `diskmgmt.msc` → 새 디스크 보임 → online → initialize (GPT) → NTFS format (allocation unit = 64K 권장 — 게임 large file 워크로드)
4. 드라이브 letter Z: 할당

**측정**:

```powershell
# CrystalDiskMark CLI 또는 fio for Windows
fio --name=iscsi-seq --filename=Z:\test.bin --rw=read --bs=1M --size=4G --iodepth=32 --runtime=30
fio --name=iscsi-rand --filename=Z:\test.bin --rw=randread --bs=4k --iodepth=64 --runtime=30
```

### Track B — SMB (Samba) 경로

**Setup (NAS 호스트)**:

1. `apt install samba` 확인
2. `/etc/samba/smb.conf` 에 spike share 추가:

   ```ini
   [spike0]
       path = /srv/spike0
       valid users = spike
       read only = no
       create mask = 0664
       directory mask = 0775
   ```

3. user 생성 — `useradd -M spike && pdbedit -a spike`
4. `mkdir -p /srv/spike0 && chown spike:spike /srv/spike0`
5. `systemctl restart smbd nmbd`

**Windows client**:

1. `net use Z: \\<nas-ip>\spike0 /user:spike <password> /persistent:yes`
2. fio 측정 (위 iSCSI 와 동일 명령, 경로만 변경)

### Steam 워크로드 테스트 (두 트랙 중 더 나은 결과 선택)

1. Steam → Settings → Storage → Library Folders → "+" → Z: 추가
2. 후보 게임 1개 설치 (게임 선택은 본인 결정 — **Open Decisions TBD-7** 참조)
3. 설치 완료 후 첫 실행 — 메인 메뉴 진입 + 인게임 5분 플레이
4. 7일간 매일 30분~1시간 플레이, 다음 항목 일지 기록:
   - 마운트 끊김 횟수 (Windows 이벤트 로그 + Steam 에러 다이얼로그)
   - 로딩 시간 (스플래시→메인메뉴, 메인메뉴→인게임)
   - 게임 내 FPS / stutter 발생
   - Anti-Cheat 차단 알림 유무
   - NAS 호스트 `dmesg` 의 iSCSI/Samba 관련 에러

---

## Decision Gate (Pass / Fail 기준)

| 항목 | Pass 기준 | Fail 시 조치 |
|---|---|---|
| Steam 게임 첫 실행 | 메인 메뉴 진입 + 5분 플레이 가능 | **즉시 spike 중단**. Anti-Cheat 차단이면 다른 게임 1개 재시도. 그것도 실패 시 PRD 가설 폐기 |
| 7일 단기 무탈 플레이 | 마운트 끊김 ≤ 1회/주 + 게임 크래시 0회 | 끊김 원인 분석 (네트워크 vs 데몬). 빈도 높으면 30일 검증 무의미 — PRD 재정의 |
| Seq read throughput | ≥ 100 MB/s (마운트 위) | baseline 과 비교. baseline 자체가 100 미만이면 하드웨어 업그레이드 결정. baseline 충분한데 마운트 위에서만 미달이면 캐시 튜닝 phase 추가 |
| Random 4K IOPS | ≥ 500 | 미달 시 L2 cache (bcache/lvmcache/L2ARC) 도입을 phase 1 전 prerequisite 로 격상 |
| 마운트 자동 재연결 | 재부팅 후 자동 마운트 성공 | "Persistent" 옵션 미작동 시 가족 onboarding UX 가 깨짐 — phase 3 디자인에 manual 재마운트 가이드 필수 추가 |

**Go decision** = 4개 이상 Pass + Steam 첫 실행 Pass(필수).
**No-Go decision** = Steam 첫 실행 Fail 또는 7일 무탈 Fail. PRD 를 superseded 처리하고 새 PRD (예: HTTP-only 강화 + SMB 가이드 문서) 로 reframe.

---

## Files to Create

| File | Action | EOL | Justification |
|---|---|---|---|
| `docs/spikes/phase0-steam-network-storage.md` | CREATE | CRLF | spike 진행 일지 + baseline 측정치 + 7일 게임 로그 + Pass/Fail 결정. Windows 편집 → CRLF |
| `docs/spikes/scripts/fio-baseline.sh` | CREATE | LF | NAS 호스트(Linux)에서 실행할 fio 표준 워크로드 wrapper. shellcheck 통과 필수 |
| `docs/spikes/scripts/fio-baseline.ps1` | CREATE | CRLF | Windows client 에서 동일 워크로드를 마운트된 드라이브 위에서 실행 |
| `.claude/prds/network-storage-reframing.prd.md` | UPDATE | (기존 EOL 보존) | Phase 0 row 의 status `pending` → `in-progress` (spike 시작 시), 종료 시 `complete` + Pass/Fail 결과 1줄 |

> `docs/spikes/` 디렉토리는 신규 — 향후 다른 spike 도 같은 곳에 누적 (예: phase 0.5, phase 1 의 prerequisite spike). README.md 는 첫 spike report 작성 시 함께 생성.

## NOT Building

- **자동화 스크립트(IaC)**: setup 단계의 `targetcli`/`smb.conf` 를 Ansible 로 만들지 않음. **수동 = 의도된 비용** — 자동화하면 어디서 막히는지·UX 가 얼마나 험한지 모름. phase 3 web 콘솔 설계의 풍부한 fuel.
- **양 트랙 동시 비교 보고서**: 한 트랙(예: iSCSI) 이 Steam 첫 실행 통과하면 그 트랙으로만 7일 무탈 검증 진행. SMB 트랙은 그 후 별도 측정으로 진행 (시간 절약).
- **multi-tenant / 가족 사용자 발급**: phase 5 의 범위. spike 는 single-user 만.
- **production 보안 설정**: CHAP 인증, SMB3 encryption, Kerberos 등은 phase 5+ 에서. spike 는 trust your LAN 가정.
- **Web UI 변경**: 코드 변경 0줄 = spike 의 정의.

---

## Step-by-Step Tasks

### Task 1 — Pre-spike baseline 측정 + 기록
- **ACTION**: `iperf3` + `fio` 로 NIC·로컬디스크·캐시 baseline 3종 측정
- **DELIVERABLE**: `docs/spikes/phase0-steam-network-storage.md` 의 "Baseline" 섹션
- **VALIDATE**: 세 측정치 모두 ≥ 1회 반복 + 값 기록. iperf3 결과가 명백히 낮으면(예: <100 MB/s) NIC/스위치/케이블 문제 먼저 해결 후 spike 진입.

### Task 2 — iSCSI Track 설정 + 측정 (Track A)
- **ACTION**: 위 "Track A" 절차 수행
- **DELIVERABLE**: spike report 의 "Track A — iSCSI" 섹션 + fio 결과 raw output paste
- **GOTCHA**: targetcli 의 `saveconfig` 호출을 잊으면 재부팅 시 설정 증발. 매 단계 후 `ls` 로 트리 확인.
- **VALIDATE**: Windows 디스크 관리자에 새 디스크 보이고 NTFS 포맷 + fio seq read 측정 완료.

### Task 3 — SMB Track 설정 + 측정 (Track B)
- **ACTION**: 위 "Track B" 절차 수행
- **DELIVERABLE**: spike report 의 "Track B — SMB" 섹션
- **GOTCHA**: `pdbedit -a` 의 SMB 패스워드는 Linux user 패스워드와 별개. 둘을 같게 두면 안전성 ↓, 다르게 두면 spike 운영 부담 ↑ — spike 에선 다르게 + report 에 평문 기록 금지 (1Password 참조 또는 placeholder).
- **VALIDATE**: `net use` 성공 + fio 측정 완료. 끝나면 `net use Z: /delete` 로 정리.

### Task 4 — Steam 게임 선택 + 설치 + 첫 실행
- **ACTION**: Track A/B 중 더 나은 결과 트랙으로 Steam Library 추가 → 게임 1개 설치 → 첫 실행
- **DELIVERABLE**: 첫 실행 스크린샷 + Steam 설치 위치 확인 (`Z:\SteamLibrary\steamapps\common\<game>`)
- **GOTCHA**: 일부 Anti-Cheat (EAC, BattlEye) 는 네트워크 드라이브를 명시적으로 거부. 후보 게임이 이런 보호를 쓰는지 사전 확인.
- **VALIDATE**: 메인 메뉴 진입 + 5분 인게임 플레이 + 에러 다이얼로그 없음.

### Task 5 — 7일 무탈 일지 + 종합 Pass/Fail 결정
- **ACTION**: 매일 플레이 + 일지 기록. 마지막 날 Decision Gate 표 채우기.
- **DELIVERABLE**: spike report 의 "Decision" 섹션 — Go/No-Go + 근거.
- **VALIDATE**: Decision Gate 4개 이상 Pass 확인. PRD 의 Phase 0 row 를 결과에 따라 갱신.

### Task 6 — PRD Phase 0 row 상태 + 결과 반영
- **ACTION**: PRD 의 Phase 0 row 를 `complete` + Plan PRP 컬럼에 본 plan 경로 추가. Decision 이 No-Go 면 PRD frontmatter status 를 `superseded` 로 바꾸고 새 PRD 작성 트리거.
- **DELIVERABLE**: 갱신된 PRD
- **VALIDATE**: `grep -n "Phase 0" .claude/prds/network-storage-reframing.prd.md` 로 상태 변경 확인.

---

## Open Decisions (spike 시작 전 결정 필요)

| # | 결정 항목 | 선택지 | 권장 |
|---|---|---|---|
| **TBD-7** | spike 게임 선택 | (a) single-player offline (Stardew Valley, Hades 등 — Anti-Cheat 무관), (b) online multi-player with Anti-Cheat (실전 워크로드지만 차단 위험 ↑) | **(a) 로 첫 실행 통과 확인 → (b) 로 confirm round**. (a) 는 가설 사망 여부만 빠르게 가린다 |
| **TBD-8** | iSCSI vs SMB 우선 측정 트랙 | (a) iSCSI 먼저, (b) SMB 먼저, (c) 둘 동시 | **(a)** — 가설의 본질(game on block-level mount) 에 가까움 |
| **TBD-9** | spike 게임 라이센스/위치 | 본인 기존 Steam 라이브러리 / 신규 구매 | **기존 라이브러리 활용** (cost 0) |

---

## Validation Commands

### Baseline 측정 (NAS 호스트, Linux)
```bash
iperf3 -c <nas-ip> -t 30 -P 4
bash docs/spikes/scripts/fio-baseline.sh /path/on/raid5
```
EXPECT: iperf3 ≥ 240 MB/s, fio seq read ≥ 100 MB/s

### 마운트된 디스크 측정 (Windows client)
```powershell
.\docs\spikes\scripts\fio-baseline.ps1 -DriveLetter Z
```
EXPECT: seq read ≥ 100 MB/s, random 4K ≥ 500 IOPS

### Spike report 완성도 검증
```bash
grep -E "^## (Baseline|Track A|Track B|Decision)" docs/spikes/phase0-steam-network-storage.md
```
EXPECT: 4개 섹션 모두 매치

### EOL 검증 (CLAUDE.md 규칙)
```bash
file docs/spikes/phase0-steam-network-storage.md  # → CRLF line terminators
file docs/spikes/scripts/fio-baseline.sh           # → ASCII text (LF)
file docs/spikes/scripts/fio-baseline.ps1          # → CRLF line terminators
```

### Manual Validation
- [ ] iperf3, fio (Linux/Windows 둘 다), targetcli, samba, Windows iSCSI Initiator 설치/접근 가능
- [ ] NAS 호스트에 root SSH 접근 가능
- [ ] spike 종료 후 spike0 target/share 정리 (`targetcli /iscsi delete`, `pdbedit -x spike`, share path 삭제)
- [ ] spike report 의 평문 패스워드 없음 (`grep -i password docs/spikes/phase0-*.md` 결과 0건 또는 placeholder 만)

---

## Acceptance Criteria

- [ ] Baseline 3종 측정 완료 + report 기록
- [ ] Track A (iSCSI) 또는 Track B (SMB) 중 최소 1개 트랙에서 fio + Steam 첫 실행 통과
- [ ] 7일 일지 작성 완료 + Decision Gate 5개 항목 평가 완료
- [ ] PRD 의 Phase 0 row status 갱신
- [ ] Go/No-Go 결정 + 근거 1단락 spike report 에 명시
- [ ] spike 자원 정리 (target/share/user 제거, 테스트 데이터 삭제)

## Completion Checklist

- [ ] spike report 가 다른 사람이 동일 spike 를 재현할 수 있을 만큼 상세
- [ ] 평문 secret/password 노출 없음
- [ ] EOL 규칙 (Linux script LF, Windows doc CRLF) 준수
- [ ] PRD 의 TBD-1 (SMB vs iSCSI 우선), TBD-5 (병목 위치) 에 대한 답이 spike report 에 명시됨
- [ ] No-Go 시 후속 작업 트리거 (PRD reframe) 명확

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anti-Cheat 가 네트워크 드라이브 차단 → Steam 첫 실행 실패 | M | H (가설 사망) | Task 4 에 single-player + multi-player 2단계 검증. single-player 만 통과해도 부분 Go 가능 |
| 본인 시간 가용성 부족 → 7일 일지 미작성 | H | M | "30일" 은 phase 0 종료 후 백그라운드로. phase 0 자체는 7일 단기 + Decision Gate 만 |
| spike 자원이 운영 NAS 와 충돌 (포트, 디스크 공간) | M | M | `/srv/spike0` 별도 path + 별도 target IQN + 별도 SMB share name. spike 종료 시 정리 체크리스트 |
| spike report 에 평문 패스워드 실수 commit | L | H | grep validation + `git diff` 사전 확인 + 패스워드는 1Password 참조로만 기록 |
| baseline 측정이 RAID rebuild·백업 등 다른 IO 와 겹쳐 noise | M | M | NAS 호스트에서 `iotop` / `top` 으로 다른 IO 확인 후 측정. 측정 시각 report 에 기록. |

## Notes

- 이 plan 은 **코드를 생성하지 않는 plan** 이라는 점이 특이. ECC 표준은 코드 변경 task 를 가정하지만, PRD 가 "spike 먼저, 코드는 그 다음" 을 명시적으로 요구 — plan 형식만 따르고 task 내용은 매뉴얼 절차 + 측정 + 의사결정.
- spike 결과가 plan / PRD 의 후속 phase 들을 모두 다시 정의할 수 있다는 점에서, 이 plan 의 진짜 산출물은 "report + Go/No-Go 결정" 이지 "코드" 가 아니다.
- 30일 무탈 검증의 나머지 23일은 phase 1+ 와 병렬로 진행 — 단, 그 23일 안에 끊김·크래시가 누적되면 phase 1+ 도 일시중단 + retrospect.

# Terab — Network Storage Reframing (v0.2 Purpose Realignment)

> **Status**: DRAFT — 2026-05-25
> **Scope**: 프로젝트 목적 재정의 및 v1 목표 재수립. 기존 구현(File CRUD + 2FA + Web UI)을 폐기하지 않으면서 product framing을 "셀프호스팅 Dropbox 클론" → "가족용 multi-tenant network storage + 보조 web/mobile + 자동화 호스트"로 전환한다.

---

## Problem Statement

가족 4명을 위한 NAS 활용에서 현재 시장 솔루션은 두 패러다임 중 하나만 잘한다 — **(a) Cloud sync (Google Drive, Synology Drive, Nextcloud)**는 모바일/웹 UX는 좋지만 PC 게임/프로그램을 NAS에 설치해 실행할 수 없고 동기화 복사본 때문에 용량·트래픽 비용을 이중으로 지불한다. **(b) Network storage (DSM SMB/iSCSI, TrueNAS)**는 직접 마운트로 그 한계를 풀지만 권한·공유 발급이 관리자 수동 작업이라 가족/소규모 팀이 셀프서비스로 쓸 수 없다. 이 공백 때문에 사용자는 PC를 24/7 켜두거나 외장 SSD를 들고 다니는 등 비효율을 감내하고 있다.

## Evidence

- 사용자 1차 인터뷰 (2026-05-25, 본인): "Google Drive는 클라우드처럼 동작해서 PC 게임/프로그램을 설치해 동작시킬 수 없음 → 클라우드가 아닌 저장소처럼 접근하고 싶음"
- 동일 인터뷰: "Synology Drive 앱은 Cloud처럼 동작. DSM에서 SMB/iSCSI를 제공하지만 DSM 내부에서 매번 관리자가 설정해야 함 — 여러 사람이 쓰기 부적합"
- 비용 압박: "Google Drive 동기화로 4TB+ 데이터 수용 시 유지비 비싸짐", "Serverless는 트래픽 비용 상당"
- 트리거 사건: "현재 구현한 File 시스템에 다운로드 기능을 추가하며 정책이 목표와 차이가 있는 것 같아 확인" — 즉, HTTP CRUD 위주 구현이 진짜 목표(네트워크 마운트)와 어긋남을 자각
- **검증 필요(TBD)**: 가족 구성원 3명의 독립 인터뷰 — 본인이 대리 응답한 부분이 있음. v0.2 출시 전에 가족 사용자에게 동일 질문 확인 필요.

## Proposed Solution

NAS의 **실제 파일시스템을 source of truth**로 두고, 그 위에 **두 개의 동시 접근 채널**을 제공한다:

1. **Primary channel — Network mount (SMB / iSCSI)**: 사용자가 웹 콘솔에서 셀프서비스로 자격증명을 발급받아 PC/Mac에서 직접 마운트. 게임·프로그램 실행, 동기화 없는 직접 R/W가 가능해야 함. 100MB/s+ throughput 보장.
2. **Secondary channel — Mobile/Web (HTTP REST)**: 기존 구현된 File API + Web UI를 모바일 접근/공유링크/권한 관리 콘솔로 재포지셔닝. 동일 파일에 동일 권한으로 접근.

권한·사용자·공유는 **양 채널에 단일 모델**로 적용 (SMB ACL과 DB permission이 같은 source에서 파생). v1 이후에 sandboxed 자동화 스크립트 호스트를 얹는다.

## Key Hypothesis

> **본인이 NAS에 설치한 Steam 게임을 한 달 이상 불편 없이 플레이한다.**

이 가설이 검증되면 = (a) iSCSI/SMB 마운트가 throughput·지연·안정성 면에서 게임 실행 워크로드를 견딘다는 기술 타당성, (b) "동기화 없이 NAS를 로컬 디스크처럼 쓴다"는 핵심 가치 명제가 실증된다는 것을 동시에 의미한다. Steam은 random access + 파일 락 + 큰 dataset 측면에서 거의 최악 케이스이므로, 이걸 통과하면 그 외 워크로드(문서/사진/일반 파일)는 자연 충족된다.

## What We're NOT Building (v1)

- **미디어 트랜스코딩/스트리밍 강화 (Plex/Jellyfin 영역)** — "NAS 자원 최소 사용" 원칙과 정면 충돌. NAS는 dumb storage로 유지.
- **자체 백업/스냅샷 시스템 (Time Machine, Restic 호환, 원격 백업)** — SMB 마운트가 되면 외부 백업 도구로 충분. v1에서 자체 구현 불필요.
- **AI/의미 검색 등 고급 탐색** — Immich-like 일괄인식·의미검색. NAS 자원 소모 크고 reframing과 부합 낮음.
- **외부망 공유 서비스화 (외부인 초대·일회용 공유링크)** — 가족 내부 + 본인 외부 접근까지만. v1.x 이후 검토.
- **자동화 스크립트 호스트 (5-6 요구사항)** — v1 가설 검증과 무관. v2+로 이연.

## Success Metrics

| Metric                                     | Target                | How Measured                                       |
| ------------------------------------------ | --------------------- | -------------------------------------------------- |
| **Primary** — 본인 Steam 플레이 무탈 일수  | ≥ 30일 (연속)         | 게임 크래시·로딩 지연·마운트 끊김 일지 (직접 기록) |
| **Primary** — Sequential read throughput   | ≥ 100 MB/s            | `fio` 또는 `CrystalDiskMark`로 SMB 마운트 측정     |
| Random 4K IOPS (Steam-like)                | ≥ 500 IOPS            | `fio --rw=randread --bs=4k`                        |
| 마운트 자격증명 발급 ~ 첫 R/W              | ≤ 5분 (UI 클릭 기준)  | 본인이 신규 사용자 시뮬레이션해 stopwatch          |
| 가족 1인 SMB 마운트 성공 (튜토리얼만 보고) | ≥ 1명                 | 가족 onboarding 시험                               |
| Google Drive 월 사용량 감소                | ≥ 50% (baseline 대비) | Google One 사용량 대시보드                         |

## Open Questions

- [ ] **TBD-1**: SMB(Samba) vs iSCSI 중 v1 어느 하나만 먼저 갈 것인가, 둘 다 동시에? (게임은 iSCSI가 유리, 일반 파일은 SMB가 유리)
- [ ] **TBD-2**: 자격증명 발급 시 OS 계정과 매핑할 것인가, terab 자체 계정만 가질 것인가? (Samba PDC vs standalone)
- [ ] **TBD-3**: 현재 DB의 `files`/`folders` 테이블은 v1에서 어떤 역할을 갖는가 — (a) 폐기, (b) 메타데이터/공유링크용으로 축소, (c) HTTP 채널 전용으로 유지하고 SMB와 분리? 결정에 따라 schema migration 규모가 크게 달라짐.
- [ ] **TBD-4**: 가족 3명에 대한 독립 검증 인터뷰 미실시 — 본인의 대리 응답이 가족 실제 needs와 얼마나 정렬되는지 확인 필요.
- [ ] **TBD-5**: 100MB/s 목표가 현 하드웨어(2.5GbE LAN, RAID 5 14TB×4, 990 PRO RAID1)에서 실제로 어디서 병목인지 사전 측정 필요. NIC인지, HDD인지, 클라이언트 측인지.
- [ ] **TBD-6**: trustToken sliding expiry 등 [project_auth_2fa_fallback_pending](memory) 결함이 multi-tenant 발급 흐름에 영향 주는가?

---

## Users & Context

**Primary User — 본인 (Operator + Power User)**

- **Who**: NAS를 직접 구축·운영하는 기술 prosumer. 가족 IT 책임자 역할.
- **Current behavior**: Google Drive 유료 + 외장 SSD 수동 백업 + PC 24/7 켜두기.
- **Trigger**: NAS에서 게임·프로그램 직접 실행이 안 되어 PC를 못 끔.
- **Success state**: PC를 끄거나 출장 가도 NAS만 켜져 있으면 가족 사용 + 본인 게임 라이브러리 정상 동작.

**Secondary User — 가족 구성원 3명**

- **Who**: 비기술 사용자, 본인이 발급해주는 자격증명을 받아 사용.
- **Current behavior**: 카톡으로 사진 공유, 개인 폰에 사진 누적되다 용량 경고.
- **Trigger**: 폰 용량 부족 / 가족 단위 사진 공유 욕구.
- **Success state**: 모바일 앱에서 사진을 NAS로 자동 백업 + PC에서 SMB 마운트로 가족 공용 폴더 접근.

**Job to Be Done**

> When PC를 끄고 외출하거나 가족이 새 기기로 파일·사진에 접근해야 할 때,
> I want to NAS를 마치 그 기기의 로컬 디스크처럼 직접 마운트하거나 모바일로 접근하기를 원한다,
> so I can 동기화 복사본을 만들지 않고, 클라우드 구독료/PC 전력비를 지불하지 않고도, 게임·프로그램·일상 파일을 정상 사용할 수 있다.

**Non-Users**

- 엔터프라이즈 NAS 운용팀: 클러스터링·SLA·감사로깅 요구 미충족.
- "그냥 사진만 백업하고 싶은" 사용자: Immich/Synology Photos가 더 적합.
- 일회성 외부인과의 파일 공유가 주 목적인 사용자: WeTransfer류가 더 적합.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority   | Capability                                                                         | Rationale                                    |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| Must       | NAS 호스트에 Samba/iSCSI target 설치·운영                                          | 모든 v1 가치의 전제                          |
| Must       | 웹 콘솔에서 SMB(또는 iSCSI) 사용자/share 셀프서비스 발급·회수                      | "관리자가 매번 설정"을 해결하는 핵심 차별점  |
| Must       | 발급된 자격증명을 PC 마운트 가이드와 함께 다운로드 (.bat/.ps1/`net use` 스니펫 등) | 가족 사용자 onboarding 마찰 ↓                |
| Must       | 단일 사용자 모델 (DB user ↔ Samba user 매핑)                                       | 양 채널 권한 정합성                          |
| Must       | sequential 100MB/s+ 통과 검증 도구·문서                                            | 가설 검증 metric 자체                        |
| Must       | Steam 워크로드 호환 검증 (게임 1개 정상 플레이 1주 이상)                           | 가설의 1차 통과 기준                         |
| Should     | 개인 영역 + 공용 영역의 명확한 구분 (top-level share = drive)                      | "공용·개인 분리" (5-4)                       |
| Should     | 모바일/웹에서 동일 파일 R/W (기존 HTTP File API 재사용)                            | 기존 자산 보존                               |
| Should     | 마운트 세션 모니터링 (현재 마운트 중인 클라이언트 목록·끊기)                       | 가족 환경 디버깅 시                          |
| Could      | Quota per drive                                                                    | v1 가족 4인 규모에선 신뢰 기반으로 우회 가능 |
| Could      | 외부망(WAN) 접근 — WireGuard/Tailscale 가이드 (운영 가이드만, 코드 X)              | 가족 외부 접근                               |
| Won't (v1) | 미디어 트랜스코딩, 자체 백업, AI 검색, 외부인 공유링크, 자동화 스크립트 호스트     | (위 "What We're NOT Building" 참고)          |

### MVP Scope

> "본인 PC에 NAS의 iSCSI(또는 SMB) target을 마운트하고, 거기에 Steam 게임 1개를 설치해서 한 달 이상 정상 플레이한다."

이걸 달성하기 위한 최소 surface = (a) NAS에서 iSCSI/SMB target 운영, (b) 웹 콘솔에서 1인용 발급/회수, (c) `fio`/`CrystalDiskMark`로 throughput 측정 + 일지 기록 도구. 가족 사용자/공용 영역/모바일 동기화는 MVP에 **없음** — 그 다음 phase.

### User Flow (Critical Path)

1. 본인이 웹 콘솔 로그인 (2FA 통과 — 기존 구현 재사용)
2. "내 드라이브" → "마운트 발급" → SMB/iSCSI 선택
3. 자격증명 + 마운트 가이드 다운로드 (.ps1)
4. PC에서 스크립트 실행 → Z: 드라이브로 마운트
5. Steam → 라이브러리 설치 위치를 Z: 로 추가 → 게임 설치 → 실행
6. 7일 후 throughput·크래시 일지 자동 알림

---

## Technical Approach

**Feasibility**: **MEDIUM** — Samba/LIO(iSCSI) 자체는 검증된 OSS지만, **NestJS 서비스가 호스트 OS 레벨 데몬을 안전하게 관리하는 통합 레이어가 새 영역**. 권한 모델 변환(DB ↔ Linux UID/GID ↔ Samba ACL)이 비명시적 복잡도 source.

**Architecture Notes**

- 기존 `files`/`folders` 테이블은 **메타데이터·공유링크·휴지통용으로 축소**하고, 실제 파일은 NAS 디스크의 디렉토리 트리가 source of truth. 새로 추가될 핵심 entity: `drives`(top-level mount point), `mount_credentials`, `share_grants`.
- API 서비스는 호스트 OS의 Samba/targetcli 설정을 직접 manipulate하지 않고, **별도 NSS/PAM 백엔드 또는 idmap을 통해 위임** (보안 격리). 후보: `pam_terab` socket + Samba `idmap_script`.
- HTTP File API는 살리되, 그 storage backend가 MinIO에서 **로컬 파일시스템(NAS mount)으로 전환**. MinIO는 v1.x 이후 cold storage/snapshot 용도로 재고려.
- 기존 ADR 0001 (Swagger/hey-api) · 0002 (2FA Strategy)는 그대로 유효. 새 ADR 후보: **0003 "Storage SoT를 PostgreSQL+MinIO에서 NAS filesystem으로 이전"**, **0004 "Samba/iSCSI 통합 패턴"**.

**Technical Risks**

| Risk                                                                                      | Likelihood | Mitigation                                                                                            |
| ----------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| iSCSI/SMB 위에서 Steam이 실제로는 동작 안 함 (특정 anti-cheat·DRM이 마운트된 디스크 거부) | M          | MVP phase 0에서 spike — 매뉴얼 마운트 + Steam 1게임으로 사전 검증. 실패 시 가설·MVP 재정의.           |
| 2.5GbE 환경에서 RAID 5 HDD가 100MB/s sustained를 못 받침 (4K random 특히)                 | M          | SSD를 cache tier(lvmcache/bcache/ZFS L2ARC)로 배치. 사전 `fio` 벤치마크로 baseline 측정.              |
| 호스트 OS 레벨 데몬 관리를 NestJS에서 하는 것의 보안 표면 (root 권한 필요)                | H          | 별도 privileged sidecar (Go/Rust 작은 데몬) + API는 unix socket으로만 통신. Capability 최소화.        |
| 기존 `files` 테이블의 source of truth 이전 = breaking change                              | H          | 신규 drive 부터 새 모델 적용, 기존 `files`는 deprecation path로 유지. 데이터 마이그레이션 별도 phase. |
| 가족 사용자 onboarding 마찰 (Windows 마운트 UI 복잡함)                                    | M          | `.bat`/`.ps1` 자동 생성 + 1회용 QR 코드 가이드. 가족 사용성 테스트 phase 4에 둠.                      |
| 외부망 접근 시 SMB 노출 = 보안 사고 직결                                                  | H          | 외부망은 WireGuard/Tailscale 경유만 권장. 직접 SMB WAN 노출은 문서·UI 모두 금지 표기.                 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| #   | Phase                                       | Description                                                                                                                  | Status      | Parallel | Depends | PRP Plan                                                                                                                              |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Spike: Steam-on-iSCSI 사전 검증             | 수동으로 LIO iSCSI target 만들고 PC에서 마운트해 Steam 게임 1개 설치·실행. fio 벤치마크 baseline. 가설 사망 가능성 조기 탐지 | complete    | -        | -       | [phase0-spike](../plans/network-storage-reframing-phase0-spike.plan.md) · [report](../../docs/spikes/phase0-steam-network-storage.md) |
| 1   | Storage SoT 재정의 ADR + schema 설계        | ADR 0003 작성. `drives`/`mount_credentials`/`share_grants` 스키마 초안. 기존 `files` deprecation 경로 명시                   | complete    | with 2   | 0       | [phase1-sot-adr-schema](../plans/network-storage-reframing-phase1-sot-adr-schema.plan.md)                                             |
| 2   | Privileged storage agent (sidecar) 골격     | Go 데몬 (.spk 배포 + synowebapi CLI 위임 + HTTP-over-unix-socket) + NestJS 클라이언트 wrapper + fakedsm 통합 테스트          | complete    | with 1   | 0       | [phase2-sidecar-agent](../plans/network-storage-reframing-phase2-sidecar-agent.plan.md)                                               |
| 3   | Web 콘솔: 1인용 발급/회수 + 가이드 다운로드 | "내 드라이브" + 마운트 발급 UI. `.ps1`/`.bat` 자동 생성. (가족 발급은 phase 5에서)                                           | in-progress | -        | 1, 2    | [phase3-self-issuance-ui](../plans/network-storage-reframing-phase3-self-issuance-ui.plan.md)                                         |
| 4   | MVP 가설 검증 (1인용)                       | 본인 계정으로 Steam 1게임 30일 무탈 플레이. throughput·crash 일지. 통과 시 phase 5+로, 실패 시 PRD 재정의                    | pending     | -        | 3       | -                                                                                                                                     |
| 5   | Multi-tenant 확장                           | 가족 3명 계정 발급, 개인 영역 + 공용 영역 구분, SMB user 매핑                                                                | pending     | with 6   | 4       | -                                                                                                                                     |
| 6   | HTTP File API SoT 이전                      | 기존 File API의 storage backend를 MinIO → NAS filesystem으로 전환. 양 채널 동일 view 보장                                    | pending     | with 5   | 4       | -                                                                                                                                     |
| 7   | 모바일/웹 채널 재포지셔닝                   | 기존 Web UI를 "마운트 안 한 환경에서의 보조 접근"으로 재배치. 가족 사용성 테스트                                             | pending     | -        | 5, 6    | -                                                                                                                                     |

### Phase Details

**Phase 0 — Steam-on-iSCSI Spike**

- **Goal**: 가설이 기술적으로 가능한지 코드 작성 전에 확인
- **Scope**: 호스트에 수동 LIO 설정 + Windows 마운트 + Steam 1게임 + `fio` baseline
- **Success signal**: 게임 1회 정상 실행 + 100MB/s seq read 도달. 어느 하나라도 실패 시 PRD 재정의.

**Phase 1 — Storage SoT ADR + Schema 설계**

- **Goal**: 기존 `files`/`folders` 모델의 역할 변화를 ADR로 못박고, 새 스키마(`drives`, `mount_credentials`, `share_grants`) 초안 합의
- **Scope**: ADR 0003 + drizzle schema PR (마이그레이션은 phase 5/6에서)
- **Success signal**: ADR accepted, schema review 통과

**Phase 2 — Privileged Storage Agent**

- **Goal**: NestJS 본체에 root 권한을 주지 않고 호스트 데몬을 안전하게 조작
- **Scope**: 작은 Go/Rust 데몬 + unix socket protocol + Samba/targetcli wrap
- **Success signal**: agent로 SMB share 1개 생성·회수가 cmdline에서 가능

**Phase 3 — Web 콘솔 발급 UI (1인용)**

- **Goal**: 가설 검증을 위한 최소 셀프서비스 인터페이스
- **Scope**: "내 드라이브" 페이지 + 마운트 발급 + 가이드 다운로드. 가족 사용자 추가 UI는 미포함
- **Success signal**: 본인이 web에서 클릭만으로 SMB·iSCSI 둘 다 발급해 PC에서 마운트 성공

**Phase 4 — MVP 가설 검증**

- **Goal**: "Steam 30일 무탈 플레이" 가설 통과 여부 결정
- **Scope**: 본인 단독 사용 + 일지 기록 도구 + 주간 throughput 측정
- **Success signal**: 30일 일지 통과. 실패 시 회고 후 PRD 재정의.

**Phase 5 — Multi-tenant 확장**

- **Goal**: 가족 4인 셀프서비스 가능하도록 확장
- **Scope**: 사용자 ↔ Samba user 매핑, drive 단위 quota는 v1.1, 개인/공용 share 구분
- **Success signal**: 가족 1명 이상이 가이드만 보고 자력 마운트 성공

**Phase 6 — HTTP File API SoT 이전**

- **Goal**: 양 채널이 같은 파일을 보도록 정합
- **Scope**: 기존 file.service의 storage backend 교체, MinIO는 v1 이후 재고려
- **Success signal**: SMB에서 쓴 파일이 Web UI에서 그대로 보임, vice versa

**Phase 7 — 보조 채널 재포지셔닝**

- **Goal**: 기존 Web UI/모바일을 reframing에 맞게 메시징·UX 조정
- **Scope**: "이 환경에선 마운트가 어려울 때"로 보조 채널 명시화, 가족 사용성 테스트
- **Success signal**: 가족 1명 모바일에서 사진 백업 성공

### Parallelism Notes

- **phase 1 ∥ phase 2**: 스키마 설계와 sidecar 골격은 의존 없음
- **phase 5 ∥ phase 6**: multi-tenant 권한 모델과 HTTP API SoT 이전은 독립 트랙 (단, phase 7에서 합류)
- 그 외는 순차 — 특히 phase 0(spike) 통과 없이 phase 1+로 가지 말 것. 가설 사망 시 매몰 비용이 커짐.

---

## Decisions Log

| Decision                | Choice                                                                         | Alternatives                                                  | Rationale                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Product framing         | "Multi-tenant network storage + 보조 web/mobile"                               | (a) 기존 cloud sync 클론 유지, (b) HTTP-only로 SMB/iSCSI 포기 | 사용자 핵심 요구(Steam 실행, 동기화 없는 직접 마운트)가 HTTP로는 물리적 불가능               |
| MVP 검증 시나리오       | Steam 30일 플레이 (1인용)                                                      | (a) 가족 4인 SMB 발급, (b) 모바일 백업, (c) 자동화 스크립트   | Steam이 최악 워크로드 — 통과 시 나머지는 자연 충족. 1인용이라 가족 onboarding 마찰 변수 제거 |
| Storage source of truth | NAS filesystem 직접                                                            | (a) 현행 PostgreSQL+MinIO 유지, (b) MinIO만 유지              | SMB/iSCSI는 커널 레벨 — DB가 사이에 못 낌. 결국 어느 한쪽이 양보                             |
| Privileged 데몬 분리    | Go/Rust sidecar + unix socket                                                  | (a) NestJS가 직접 sudo, (b) systemd path unit                 | NestJS에 root 주면 supply chain 공격 표면 폭증                                               |
| v1 제외 영역            | 미디어 트랜스코딩, 자체 백업, AI 검색, 외부인 공유링크, 자동화 스크립트 호스트 | 각각 v1 포함 옵션                                             | 가설 검증과 무관 / "NAS 자원 최소" 원칙 충돌 / 보안 표면 증가                                |
| 외부망 접근 정책        | WireGuard/Tailscale 경유만 권장 (코드 X, 문서 O)                               | SMB 직접 WAN 노출                                             | SMB는 인터넷 노출 시 사고 직결 — 검증된 통념                                                 |

---

## Research Summary

**Market Context**

- Cloud sync (Nextcloud, Seafile, Synology Drive): 모바일·웹 UX 좋지만 "진짜 마운트"가 아님. Steam·게임 실행 불가
- NAS OS (TrueNAS, Unraid, DSM, QNAP): SMB/iSCSI는 강력하나 권한 발급 UX가 관리자 중심. 가족·소규모 팀 셀프서비스 약함
- 가정용 미디어 (Plex/Jellyfin/Immich): 미디어 특화 — 범용 파일/게임 다루지 않음
- 자동화 (n8n/Node-RED): 워크플로 강력하나 스토리지 통합 약함
- **terab 빈 자리** = SMB/iSCSI 셀프서비스 발급 + 통합 web/mobile 접근 + 가족/소규모 팀 규모. 정확히 이 조합을 OSS에서 제공하는 사례 미관찰 (DSM이 가장 가깝지만 폐쇄형)

**Codebase Context**

- 재사용 가능: 2FA 인증, JWT, RBAC (`permissions`, `roles`), Drizzle repository 패턴, Catalyst UI, Web 페이지(drive/share/trash/favorites), pino logger + trace, BullMQ
- 갭: SMB/iSCSI 통합 부재, host OS daemon 관리 부재, drive/quota/multi-tenant 모델 부재, 자동화 스크립트 호스트 부재
- 핵심 충돌: 현 schema(`files`/`folders`/`upload-sessions`)는 HTTP CRUD 전제. SoT 이전이 v1의 가장 큰 breaking change

**Open Research Needs (TBD)**

- 가족 3명 독립 인터뷰 (본인 대리 응답 검증)
- 현 하드웨어에서 `fio` baseline 측정 (NIC/HDD/클라이언트 어디가 병목)
- Steam Anti-Cheat의 iSCSI/SMB 마운트 호환성 (게임별 차이)
- Samba `idmap_script` vs 자체 NSS 백엔드 비교

---

_Generated: 2026-05-25 — Status: DRAFT (needs validation via Phase 0 spike + 가족 인터뷰)_

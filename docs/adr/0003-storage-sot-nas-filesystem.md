---
name: storage-sot-nas-filesystem
description: Storage source of truth를 PostgreSQL+MinIO에서 NAS filesystem 으로 이전하고 신규 entity 3종(drives / mount_credentials / share_grants) 을 도입한다
status: proposed
date: 2026-05-27
---

# ADR-0003: Storage SoT 를 NAS filesystem 으로 이전

## Status

proposed — PR #?? (머지 시점에 `accepted` + PR 번호 + 머지일로 갱신)

## Context

v0.1 까지의 terab 은 "셀프호스팅 Dropbox 클론" 으로 설계됐다. Storage 계층은 **PostgreSQL(metadata) + MinIO(object)** 였고, HTTP File API 가 양쪽을 묶어 사용자가 web/mobile 에서 업로드·다운로드·공유링크를 사용했다. files / folders / upload_sessions 스키마와 그 위의 REST 컨트롤러는 이 모델을 그대로 반영한다.

운영하면서 가설이 어긋났다.

- 1차 사용자 인터뷰 ([PRD §"Evidence"](../../.claude/prds/network-storage-reframing.prd.md)): _"Google Drive 는 클라우드처럼 동작해서 PC 게임/프로그램을 설치해 동작시킬 수 없음 → 클라우드가 아닌 저장소처럼 접근하고 싶음"_
- 트리거 사건: File 시스템에 다운로드 기능을 추가하다가 _"정책이 목표와 차이가 있는 것 같아 확인"_ — 즉, HTTP CRUD 위주 구현이 진짜 목표(네트워크 마운트로 게임/프로그램 직접 실행) 와 어긋남을 자각
- 비용 압박: Google Drive 동기화로 4TB+ 데이터 수용 시 유지비 + 동기화 복사본 이중 트래픽

이 요구를 HTTP-only 로 푸는 것은 **물리적으로 불가능**하다. Steam·게임·일반 데스크톱 프로그램은 파일을 OS 의 파일시스템 인터페이스(open/read/write/mmap)로 직접 접근하지, REST 클라이언트로 download 하지 않는다. SMB/iSCSI 는 커널 레벨 (VFS / SCSI block layer) — DB 가 사이에 못 낀다 ([PRD §"Decisions Log" Storage SoT row](../../.claude/prds/network-storage-reframing.prd.md)).

[Phase 0 spike](../spikes/phase0-steam-network-storage.md) 가 가설을 검증했다 — Ghostrunner 단일세션 + 5분 인게임 + 30분 일자 측정에서 Decision Gate 5/5 Pass, Anti-Cheat 차단 0회, 크래시 0회. iSCSI block-level 스택 자체엔 병목이 없고 1 GbE NIC 가 천장 (91.8 MB/s = 천장 111 MB/s 의 83%) 으로 확인됐다. 이로 기술 타당성이 잡혔으므로 결정을 미룰 명분이 없다.

검토된 대안:

- **현행 PostgreSQL + MinIO 유지** — HTTP 채널만으론 가설(직접 마운트 + Steam) 을 충족 불가. reframing 자체를 포기하는 셈
- **MinIO 만 유지하고 metadata 도 그 위에 얹기** — 여전히 SMB/iSCSI 가 못 들어옴. 동일 한계
- **PostgreSQL 을 master 로 두고 filesystem 을 mirror** — 양방향 동기 cost 폭증. 충돌 해소 정책 (DB vs filesystem 누가 이김) 이 매번 결정 부담
- **두 SoT 공존 (drive 별로 선택)** — 사용자 결정 부담 + 권한 모델 이중화

각 안 모두 reframing 의 핵심 가치 (양 채널 동일 view, 직접 마운트, 동기화 복사본 제거) 를 충족 못하거나, 충족하더라도 영구적인 동기 부채를 떠안는다.

## Decision

**Storage 의 source of truth 를 NAS filesystem 으로 이전한다.** 즉:

1. 사용자가 업로드·생성·수정한 파일의 권위 있는 형태는 NAS 디스크 위의 디렉토리 트리이다
2. PostgreSQL 은 SoT 가 아닌 **인덱스·권한·감사 메타스토어** 로 역할 변경
3. HTTP File API 가 보던 파일은 동일 NAS 마운트 경로의 read/write 로 처리된다 (Phase 6 의 책임)
4. SMB / iSCSI 채널과 HTTP 채널이 **같은 파일을 본다** — 양 채널 단일 view

### 신규 entity 3종 도입

| Entity | 책임 |
|---|---|
| `drives` | 사용자별 (또는 공용) 최상위 마운트 단위. NAS filesystem 의 mount path 와 1:1 mapping |
| `mount_credentials` | 사용자가 발급받은 마운트 자격증명. iSCSI IQN 또는 SMB 계정과 그 secret reference |
| `share_grants` | drive 레벨 권한 부여 (granteeUserId × accessMode × expiresAt). v1 은 drive-level grant 만 — 파일/폴더 단위 grant 는 후속 |

3종 모두 본 ADR 의 형제 PR 에서 Drizzle schema + 마이그레이션으로 추가된다 ([plan](../../.claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md)).

### 기존 `files` / `folders` / `upload_sessions` 의 운명

본 ADR 은 **deprecation 시점만 정하고, 최종 형태는 결정을 위임한다.** 두 후보가 열려 있다:

- **(a) HTTP 전용 metadata 로 축소** — 양 채널이 같은 디렉토리를 보되, files row 는 mobile/web 의 추가 메타(thumbnail key, share link, 휴지통 상태 등) 만 들고 있음. minio_key / size 같은 SoT 컬럼은 제거
- **(b) 전체 폐기** — files / folders / upload_sessions 모두 drop. 메타가 필요한 경우는 NAS filesystem 의 xattr / sidecar JSON 으로 이동

(a) vs (b) 의 결정은 본 ADR 의 책임이 **아니다**. Phase 5/6 의 실제 데이터·코드 마이그레이션 시점에 (i) 실 트래픽 패턴, (ii) 모바일 채널 사용량, (iii) NAS 환경의 xattr 지원 수준 같은 추가 정보를 갖고 ADR-0005 로 결정한다. 본 ADR 단계에서 미리 박제하면 가설 기반 over-commit 이다.

본 PR 의 diff 에는 기존 3 스키마와 `services/api/src/file/**`, `services/api/src/folder/**` 가 **단 한 줄도 포함되지 않는다** — Phase 5/6 의 책임이며 본 phase 의 scope creep 신호.

### 핵심 결정 항목 (Plan Open Decisions D1~D5)

| # | 결정 | 결과 |
|---|---|---|
| D1 | `drives.kind` 의 v1 값 | `'PRIVATE' \| 'SHARED'` 2종. SYSTEM 은 v1 가족 규모에 과함 |
| D2 | `mount_credentials.protocol` 의 SMB 컬럼 허용 | `'ISCSI' \| 'SMB'` 모두 허용. v1.x 의 SMB 도입 시 마이그레이션 비용 회피. ADR-0004 가 보류한 것은 **통합** 이지 schema 형상이 아님 |
| D3 | `share_grants.accessMode` 표현 | `'READ' \| 'WRITE'` 2종. drive grant 는 사용자 × drive 의 inheritance — 기존 `permissions` 테이블(전역 RBAC) 과 직교 모델 |
| D4 | secret 저장 전략 | `mount_credentials.secretRef` 컬럼은 Docker Secret 파일 reference (`/run/secrets/...`) 만 보관. 실제 secret 등록 흐름은 Phase 2 sidecar + Phase 3 web 발급 UI 의 합동 책임 |
| D5 | 마이그레이션 적용 시점 | 본 PR 머지와 동시에 운영 NAS 에 `db:push`. 신규 테이블 CREATE 만이라 기존 데이터 영향 0 — 일찍 적용해 Phase 2 sidecar 가 실제 DB 에 row 쓰며 개발 가능 |

## Consequences

### Positive

- **양 채널 단일 view** — Phase 6 이전이 끝나면 SMB 로 쓴 파일이 web UI 에 보이고, web UI 의 업로드가 SMB 에서 즉시 보인다. 가설의 핵심 가치
- **게임·프로그램 직접 실행** — Steam 라이브러리·Adobe 캐시·게임 세이브 같은 OS-native 파일 워크로드가 동기화 복사본 없이 동작 (Phase 0 spike 로 검증됨)
- **동기화 복사본 제거** — Google Drive 류의 "PC 로컬 사본 + 클라우드 사본" 이중 저장이 사라져 가족 4인 규모에서 TB 단위 절약. 트래픽 비용도 동반 감소
- **권한 모델 단일화의 토대** — `drives` 가 양 채널의 권한 inheritance root 가 되므로, SMB ACL 과 HTTP File API permission 이 같은 source (Phase 5) 에서 파생 가능
- **확장 여지 명시** — `drives.kind` 의 union 과 `mount_credentials.protocol` 의 union 이 v1.x 의 다중 스토리지 (SMB 추가, ZFS dataset 분리 등) 를 schema 변경 없이 흡수

### Negative

- **트랜잭션 일관성 분산** — rename + permission 갱신 같은 복합 작업이 filesystem 변경 + DB row 갱신 두 군데에 걸친다. `BEGIN ... COMMIT` 으로 묶을 수 없음. 부분 실패 시 reconcile 부담
- **MinIO 의 versioning / lifecycle 손실** — object storage 의 immutable bucket, versioning, lifecycle policy 같은 기능을 잃는다. 회복 시점도 동시에 잃음
- **backup 책임의 외부화** — 현행 MinIO 가 제공하던 cross-region replication / snapshot 책임이 외부 도구(SMB 마운트 + Restic, ZFS snapshot, 또는 DSM Hyper Backup) 로 이전된다. v1 운영자 (본인) 의 학습 부담
- **호스트 OS 의존 폭증** — Samba, iSCSI target, idmap, Linux UID/GID, xattr 지원 여부 같은 NAS OS 특성이 운영 의존성으로 들어옴. 다른 NAS OS 로의 이식성 ↓
- **filesystem ↔ DB drift 의 silent 가능성** — 외부 사용자가 SMB 로 직접 mkdir 한 폴더는 DB 에 row 가 없다. HTTP API 로 조회 시 보이지 않거나, 반대로 DB row 만 있고 파일이 없는 dangling row 가 생길 수 있음
- **breaking change 의 무게** — files / folders / upload_sessions 의 deprecation 결정 (a) vs (b) 가 Phase 5/6 까지 미뤄지는 동안 두 모델이 코드베이스에 공존 → 일시적 복잡도 ↑

### Mitigations

- **filesystem ↔ DB 동기는 별도 sidecar 의 책임** — [Phase 2 plan](../../.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md) 에서 privileged storage agent 가 filesystem 이벤트 (inotify / fsnotify) 를 구독해 DB 인덱스를 갱신. 별도 ADR 후보 (ADR-0004 형제) 로 sidecar 아키텍처 박제 예정
- **MinIO 의 versioning 은 ZFS snapshot / btrfs subvolume / NAS OS native snapshot 으로 대체 검토** — Phase 5/6 의 운영 가이드 (Phase 7 의 문서 산출물) 에서 결정
- **backup 가이드는 Phase 7 의 산출물** — SMB 마운트 + Restic 또는 DSM Hyper Backup 사용 패턴을 문서화. v1 운영자 학습 부담을 정형화
- **filesystem ↔ DB drift 는 reconcile 작업으로 흡수** — 주기적 (예: 일 1회) reconcile job 이 두 source 의 delta 를 감지해 보정. Phase 6 의 책임
- **트랜잭션 분산은 saga / outbox 패턴으로 흡수** — Phase 6 에서 NestJS service 가 (1) DB 변경 → (2) sidecar 명령 send → (3) sidecar 응답으로 DB 확정 의 순서로 멱등성 (idempotency) 보장. 부분 실패는 outbox table 에서 retry
- **deprecation path 미결정의 위험은 Phase 5/6 의 첫 작업에서 ADR-0005 로 매듭** — Phase 5/6 plan 의 첫 task 가 "기존 files / folders / upload_sessions 의 (a) 축소 vs (b) 폐기 결정 ADR" 로 강제됨. 위임이 무한 연기되지 않게 후속 plan 의 acceptance criteria 에 ADR-0005 포함

## References

- **선행 PRD**: [.claude/prds/network-storage-reframing.prd.md](../../.claude/prds/network-storage-reframing.prd.md) §"Proposed Solution", §"Technical Approach", §"Decisions Log"
- **선행 Phase 0 spike**: [docs/spikes/phase0-steam-network-storage.md](../spikes/phase0-steam-network-storage.md) §"Decision"
- **형제 ADR (iSCSI 우선 통합)**: [ADR-0004](0004-iscsi-priority-smb-deferred.md)
- **본 ADR 의 구현 plan**: [.claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md](../../.claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md)
- **Phase 2 sidecar plan (병렬 작업)**: [.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md](../../.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md)
- **신규 schema 3종**:
  - [services/api/src/database/schema/drives.schema.ts](../../services/api/src/database/schema/drives.schema.ts)
  - [services/api/src/database/schema/mount-credentials.schema.ts](../../services/api/src/database/schema/mount-credentials.schema.ts)
  - [services/api/src/database/schema/share-grants.schema.ts](../../services/api/src/database/schema/share-grants.schema.ts)
- **선행 ADR (Swagger 마이그레이션)**: [ADR-0001](0001-ts-rest-removal-swagger-migration.md)
- **선행 ADR (2FA Strategy)**: [ADR-0002](0002-twofa-strategy-pattern.md)

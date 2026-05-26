---
name: iscsi-priority-smb-deferred
description: v1 은 iSCSI 통합만 출시하고 SMB 통합은 Phase 0 spike 의 SMB Track B 가 비어 있는 점·운영자 학습 부담·검증된 워크로드 1종(Steam) 안정화를 근거로 ADR-0005 재평가 시점까지 보류한다
status: proposed
date: 2026-05-27
---

# ADR-0004: v1 은 iSCSI 우선 통합 · SMB 보류

## Status

proposed — PR #?? (머지 시점에 `accepted` + PR 번호 + 머지일로 갱신)

## Context

[PRD](../../.claude/prds/network-storage-reframing.prd.md) 의 **TBD-1** 가 명시했다:

> SMB(Samba) vs iSCSI 중 v1 어느 하나만 먼저 갈 것인가, 둘 다 동시에? (게임은 iSCSI 가 유리, 일반 파일은 SMB 가 유리)

[Phase 0 spike](../spikes/phase0-steam-network-storage.md) 가 답을 좁혔다. Spike 의 결과 요약:

- **Track A — iSCSI**: DSM 7.x SAN Manager 로 volume4 SSD 위 LUN/Target 발급 → Windows iSCSI Initiator 로 마운트 → Steam Ghostrunner 설치·30분 인게임. Decision Gate 5/5 Pass, Anti-Cheat 차단 0회, 크래시 0회. 실측 디스크 read 91.8 MB/s (1 GbE NIC 천장 111 MB/s 의 83%) + 563 IOPS
- **Track B — SMB**: **SKIP** — iSCSI 가 가설(직접 마운트 + Steam) 의 본질에 더 가깝고 production tier (volume4 SSD) 와 정합되어 운영 트랙으로 확정, SMB 비교 측정 자체를 생략

이 상태에서 v1 출시 결정은 셋 중 하나:

1. **iSCSI + SMB 동시 출시** — Phase 2 sidecar 가 양쪽 프로토콜의 발급/회수를 처리해야 함. SMB 는 Samba 설정 (`smb.conf`, `pdbedit`, idmap), iSCSI 는 LIO/`targetcli` 또는 SAN Manager — 운영 표면 2배. 검증되지 않은 워크로드(SMB) 가 v1 안정성을 끌어내릴 위험
2. **SMB 만 출시** — 가설 검증 워크로드 (Steam) 가 SMB 에선 미검증. Anti-Cheat 호환성 추가 검증 필요. 가설 사망 위험 ↑
3. **iSCSI 만 출시** — 검증된 워크로드 1종 위에서 안정화. 운영 표면 절반. SMB 는 후속 ADR 로 보류

본 ADR 은 (3) 을 선택한다. 단순히 "SMB 작업 안 함" 이 아니라 **언제 SMB 를 재평가할지 명시적 트리거** 를 박제하는 것이 본 ADR 의 가치다.

검토된 SMB-우선/혼합 시나리오:

- **가족 모바일 사진 백업** — 현실적으로 SMB 보다 HTTP File API (Phase 6 + Phase 7 의 모바일 채널) 가 더 자연스러움. iOS/Android 의 SMB 클라이언트 UX 는 일반인이 못 씀
- **PC-PC 파일 협업** — 여러 PC 가 동시 read/write 하는 일반 파일 협업 시나리오는 iSCSI 가 부적합 (파일 락 충돌). 이건 SMB 의 진짜 강점이지만 v1 가족 4인 규모에선 사용 케이스가 거의 없음
- **Mac / Linux 데스크톱** — iSCSI Initiator 셋업 마찰. SMB 가 native — 다만 v1 의 본인은 Windows + Steam 위주이고, Mac/Linux 의 가족 사용자는 모바일 채널 (Phase 6) 로 흡수 가능

## Decision

**v1 출시 범위에서 SMB 통합을 명시적으로 제외한다.** 적용 디테일:

1. **Phase 2 sidecar** 는 iSCSI 발급·회수 API 만 구현. SMB 발급은 NotImplementedError (또는 동등) 로 응답해 명시적 거부
2. **Phase 3 web 콘솔** 의 "마운트 발급" UI 는 iSCSI 만 선택지로 노출. SMB 선택지는 disabled + tooltip 으로 후속 ADR 안내
3. **신규 schema 의 `mount_credentials.protocol`** 컬럼은 `'ISCSI' | 'SMB'` 두 값을 모두 허용 — schema 마이그레이션 비용을 v1.x 의 SMB 도입 시 다시 치르지 않기 위해. **본 ADR 이 보류하는 것은 통합 (sidecar/UI/배포) 이지 schema 형상이 아니다.** Service 레이어가 SMB row 생성을 `@IsEnum(['ISCSI'])` 검증으로 차단
4. **TBD-1 답안**: iSCSI 우선. PRD §"Open Questions" 의 TBD-1 row 는 본 ADR 머지 시점에 `[x]` 로 마킹 + 본 ADR 링크

### SMB 재평가 트리거 (ADR-0005 후보)

다음 중 하나가 만족되면 새 ADR (ADR-0005 또는 후속 번호) 로 SMB 통합 여부를 재평가한다:

- **(T1) Steam 외 워크로드 본격화** — 가족 모바일 사진 백업 / 일반 파일 공유 / 가족 PC-PC 협업이 운영 데이터로 관찰 (예: 월 단위 모바일 채널 트래픽 > Steam 트래픽)
- **(T2) iSCSI 마운트 마찰 신호** — Mac/Linux 데스크톱 사용자가 가족에 추가되어 iSCSI Initiator 셋업이 onboarding 병목으로 보고됨 (가족 onboarding 시 가이드만으로 자력 마운트 실패 > 2회)
- **(T3) Steam Anti-Cheat 의 iSCSI 거부 게임** — 가족·본인이 플레이하고 싶은 게임이 iSCSI 마운트 거부 (Easy Anti-Cheat / BattlEye 의 일부 변종) — SMB 로의 우회가 필요해짐
- **(T4) 30일 가설 검증 (Phase 4) 통과 후 v1.x 확장 계획 수립 시 정기 재평가** — 트리거 신호가 없더라도 v1.x 백로그 그루밍 시점에 본 ADR 의 가정이 여전히 유효한지 점검

## Consequences

### Positive

- **통합 범위 축소 = sidecar 복잡도 절반** — Phase 2 의 unix socket protocol, agent 명령 표면, NestJS wrapper 모두 iSCSI 만 다루면 됨. PR 크기·테스트 표면·운영 학습 부담 모두 감소
- **검증된 워크로드 1종 위에서 안정화** — Phase 0 spike 가 통과한 iSCSI + Steam 위에서만 v1 출시 → MVP 가설 검증 (Phase 4 의 30일 무탈 플레이) 의 변수가 단일화. SMB 가 끌어내릴 가능성 차단
- **DSM SAN Manager 의 iSCSI 기능 직접 활용 가능** — 본인의 운영 NAS 가 Synology DSM 이므로 raw `targetcli` 가 아니라 DSM SAN Manager (GUI + `synowebapi` CLI) 위에서 sidecar 가 동작. 운영 안정성 ↑, 사고 시 DSM UI 로 수동 복구 가능
- **schema 비용은 0** — `mount_credentials.protocol` 컬럼이 SMB 도 표현 가능하므로 v1.x SMB 도입 시 schema 마이그레이션 불필요. service 레이어 enum 확장 + sidecar 명령 추가 + UI tooltip 제거만으로 가능
- **명시적 재평가 트리거** — SMB 보류가 "잊혀짐" 으로 끝나지 않도록 T1~T4 가 박제됨. 후속 결정의 명분이 명확

### Negative

- **Mac / Linux 사용자 마찰** — v1 에서 Mac/Linux 가족 구성원이 발생하면 iSCSI Initiator 셋업 가이드 부재로 자력 마운트 어려움. v1 가족 사용자는 Windows + 모바일 가정
- **가족 모바일 백업의 SMB 우회 불가** — iOS/Android 의 SMB 클라이언트로 NAS 에 직접 사진 백업하는 경로가 v1 에 없음. 모바일 사진은 Phase 6 의 HTTP File API + Phase 7 의 모바일 채널 재포지셔닝으로만 가능 — 그 경로가 늦어지면 가족 모바일 사용자의 가치 제공이 지연됨
- **일반 파일 협업 부적합** — 여러 PC 가 동시 read/write 하는 일반 파일 협업 (예: 가족 공용 엑셀 동시 편집) 은 iSCSI 의 파일 락 모델로 깨짐. v1 에선 "그건 안 됩니다" 가 정직한 답변 — 사용자 기대 관리 부담
- **SMB 코드의 학습 부채** — Samba `idmap_script` / `pdbedit` / `smb.conf` 같은 SMB 통합 노하우 축적이 v1.x 까지 미뤄짐. ADR-0005 시점에 cold start 비용
- **재평가 트리거의 주관성** — T1~T4 의 "본격화", "마찰 신호" 같은 표현이 정량 지표는 아님. 운영자 (본인) 가 정기 점검 (T4) 으로 보완해야 함 — 잊으면 평가 무한 연기 위험

### Mitigations

- **모바일 사진 백업은 Phase 6 + Phase 7 의 HTTP 채널 재포지셔닝으로 정확하게 흡수** — 본 ADR 이 보류한 SMB 가 가설을 죽이지 않도록, Phase 7 plan 의 acceptance 에 "가족 1명 모바일에서 사진 백업 성공" 포함 ([PRD Phase 7 row](../../.claude/prds/network-storage-reframing.prd.md))
- **Mac / Linux 가족 사용자가 발생하면 T2 trigger 즉시 발동** — onboarding 1회 실패 시 본 ADR 의 T2 trigger 확인 → 필요 시 ADR-0005 작성. 가족 onboarding 시험은 Phase 5 의 책임
- **일반 파일 협업 시나리오는 사용자 기대 관리로 흡수** — Phase 3 web 콘솔의 "마운트 발급" 페이지에 "iSCSI 는 단일 PC 마운트 전용 — 여러 PC 동시 사용 시 파일 손상 가능" 명시. UI 가 가드레일
- **재평가 트리거의 주관성은 quarterly grooming 으로 흡수** — v1 출시 후 분기마다 본 ADR T1~T4 점검을 Phase 7 의 운영 회고 routine 에 포함. 트리거 미발동 시에도 "재평가 안 함" 을 명시적으로 기록해 평가 누락 방지
- **schema forward-compat 으로 SMB 도입 비용 최소화** — `mount_credentials.protocol` enum 이 이미 SMB 를 포함하고 `iqn` 컬럼이 nullable 이므로 (SMB row 는 iqn = null), v1.x SMB 도입 시 schema 변경 없음 — sidecar 명령 추가 + service enum 확장 + UI tooltip 제거만

## References

- **선행 PRD**: [.claude/prds/network-storage-reframing.prd.md](../../.claude/prds/network-storage-reframing.prd.md) §"Open Questions" TBD-1
- **선행 Phase 0 spike**: [docs/spikes/phase0-steam-network-storage.md](../spikes/phase0-steam-network-storage.md) §"Decision", §"PRD TBD 응답"
- **형제 ADR (Storage SoT 이전)**: [ADR-0003](0003-storage-sot-nas-filesystem.md)
- **본 ADR 의 구현 plan**: [.claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md](../../.claude/plans/network-storage-reframing-phase1-sot-adr-schema.plan.md)
- **iSCSI sidecar plan (트리거되는 작업)**: [.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md](../../.claude/plans/network-storage-reframing-phase2-sidecar-agent.plan.md)
- **schema 의 protocol 컬럼**: [services/api/src/database/schema/mount-credentials.schema.ts](../../services/api/src/database/schema/mount-credentials.schema.ts)
- **Synology DSM 7 SAN Manager 운영 context**: DSM 7.x SAN Manager docs (외부 — 실 NAS 가 raw `targetcli` 가 아닌 DSM SAN Manager 위에서 동작)
- **선행 ADR (2FA Strategy — Strategy 패턴 참고)**: [ADR-0002](0002-twofa-strategy-pattern.md)

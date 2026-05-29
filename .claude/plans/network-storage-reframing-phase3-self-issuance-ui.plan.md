---
name: network-storage-reframing-phase3-self-issuance-ui
description: Phase 3 — 본인 1인용 iSCSI target self-service 발급/회수 + .ps1 마운트 가이드 다운로드 (API + Web FSD slices + storage-agent controller)
status: in-progress
created: 2026-05-29
---

# Plan: Phase 3 — Web 콘솔 발급 UI (1인용)

## Summary

Phase 1 ([phase1-sot-adr-schema](network-storage-reframing-phase1-sot-adr-schema.plan.md)) 의 `drives`/`mount_credentials` 스키마와 Phase 2 ([phase2-sidecar-agent](network-storage-reframing-phase2-sidecar-agent.plan.md)) 의 `StorageAgentClient` 위에, **본인 1인이 web 콘솔에서 클릭만으로 iSCSI target 을 발급/회수하고 Windows PC 용 `.ps1` 마운트 스크립트를 다운로드** 할 수 있는 최소 surface 를 깐다. 가족 사용자 발급 / 권한 모델 / 다중 사용자 share-grant 는 본 phase 의 책임이 아니다 (Phase 5). 본 phase 의 종료 신호는 PRD §"User Flow (Critical Path)" 1~5단계가 본인 환경에서 끊김 없이 완주된다는 것이며, 그 직후 Phase 4 (Steam 30일 무탈 플레이) 의 입력이 된다.

## User Story

As **본인 (operator)**,
I want to **web 콘솔에서 "내 드라이브 → 마운트 발급" 클릭 → CHAP 자격증명 + Windows `.ps1` 스크립트를 받아 PC 에서 `Z:` 드라이브로 마운트 → 마운트 후 회수까지 web UI 하나로 끝내기**,
so that **Phase 4 의 30일 게임 플레이 검증 동안 매번 DSM SAN Manager 에 SSH/UI 로 들어가지 않고도 가설 검증 phase 를 진행할 수 있고, 동일 surface 가 Phase 5 에서 가족 multi-tenant 로 자연 확장 가능하다**.

## Problem → Solution

**현재 상태**: Phase 0 spike 는 DSM SAN Manager GUI 로 *수동* 발급/마운트했고, Phase 2 의 `storage-agent` 가 `POST /v1/targets` 한 줄로 그걸 자동화했지만, **그 호출을 트리거할 controller 도 web UI 도 존재하지 않는다**. `StorageAgentModule` 은 `services/api/src/storage-agent/` 안의 service-only 모듈 — 외부 노출 0. 결과적으로 본인이 새 target 을 만들려면 여전히 DSM GUI 가 필요하고, `drives`/`mount_credentials` 테이블은 row 0건. Phase 4 검증 phase 의 *매번 발급/회수 마찰* 이 그대로 남아 있다.

**목표 상태**: (a) `DriveController` + `MountCredentialController` 2개가 `services/api` 에 등재 → JWT 인증 + 본인 ownership 검증 후 `StorageAgentClient` 호출 + DB row 작성/회수 + Docker Secret 등록/제거, (b) `services/web/src/pages/drive/` 안에 "내 드라이브 마운트" sub-section 이 widget 형태로 추가, (c) `features/mount-credential-issue` 가 발급 흐름(mutation → 1회용 CHAP secret 표시 + `.ps1` 다운로드)을, `features/mount-credential-revoke` 가 회수를 책임, (d) 본인이 PC 에서 `.ps1` 실행 → `iscsicli` cmdlet 으로 target 마운트 → `Z:` 드라이브 확인까지 web UI 외부 도구 없이 통과.

## Metadata

- **Complexity**: Large — API 측 2 모듈 신설(controller + service + repository + DTO + ErrorCode + secret 통합) + Web 측 entity 2개 + feature 3개 + widget 1개 + page 확장 + codegen 재생성 + E2E. 단일 phase 중 가장 surface 가 넓음
- **Source PRD**: [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md)
- **PRD Phase**: Phase 3 — Web 콘솔: 1인용 발급/회수 + 가이드 다운로드
- **Depends on**: Phase 1 (schema 3종) + Phase 2 (sidecar agent + StorageAgentClient) — 둘 다 `done`
- **Blocks**: Phase 4 (MVP 가설 검증 1인 30일) — Phase 3 의 surface 가 Phase 4 의 측정 도구
- **Estimated Artifacts**: ~28 — API 12개(2 module × controller/service/repository/dto/spec + 가이드 템플릿 + ErrorCode + AppModule import + env.example) + Web 14개(entities 2 + features 3 × api/model/ui/spec + widget 1 + page 1 + barrel 갱신) + E2E 1 + plan/PRD 갱신
- **Estimated Duration**: 5~8일 (API 2~3일 + Web 2~3일 + codegen + E2E + manual smoke 1~2일)
- **Parallel with**: 없음 — Phase 1·2 와 달리 단독 진행. 후속 Phase 4 가 이 산출물을 *그대로 시험하는* 사용자 경험이므로 PR 머지 직후 본인 환경 manual smoke 가 곧 가설 검증의 0일차

## Resolved Decisions (Phase 2 contract 로 사실상 결정됨)

| # | 결정 | 답변 | 근거 |
|---|---|---|---|
| **R1** | CHAP 사용 여부 | **활성화** (CHAP authentication on) | Phase 2 의 `CreateTargetRequest = { iqn, name, osUsername, osPassword }` 가 이미 CHAP 자격증명을 wire-format 으로 받음 — 사실상의 결정. Phase 0 spike 의 "CHAP disabled (LAN trust, spike)" 와 다른 path 임을 manual smoke 에서 재검증 |
| **R2** | Initiator IQN 화이트리스트 | **v1.0 미사용** | Phase 2 의 agent 인터페이스에 `allowedInitiators` 필드 미존재 — 의도된 단순화. v1.x 에서 agent contract 확장 ADR 신설 시 도입 |
| **R3** | 마운트 가이드 형식 | **`.ps1` 만** | Windows iSCSI Initiator 자동화는 `New-IscsiTargetPortal` + `Connect-IscsiTarget` PowerShell cmdlet 만 가능. `.bat` 의 `iscsicli` 는 비대화형 시나리오에서 fragile |
| **R4** | secret 저장 backend | **Docker Secret** (`/run/secrets/mount-cred-{id}`) | 루트 CLAUDE.md "secrets/ 디렉토리" 정책 + hookify.protect-secrets-dir + Phase 1 D4 위임 결과. 평문 DB 컬럼 절대 금지 |
| **R5** | CHAP password 1회 표시 + 절대 재조회 불가 | **그대로 채택** | backup-code feature ([BackupCodeSection](../../services/web/src/features/backup-code/ui/BackupCodeSection.tsx)) 의 검증된 UX 패턴. password 는 발급 응답에 1회만 포함되고, 이후 GET 응답에선 `null` |
| **R6** | personal drive 생성 시점 | **본인이 web UI 에서 "마운트 발급" 첫 클릭 시 lazy 생성** | Phase 4 의 측정 도구라 1인 1 drive 면 충분. 가족 multi-tenant 의 quota/share 는 Phase 5 |

## Open Decisions (작업 시작 전 합의)

| # | 결정 항목 | 선택지 | 권장 |
|---|---|---|---|
| **D1** | `drives` 의 `mountPath` 결정 시점 | (a) 본 phase 가 결정해 schema row 에 INSERT (예: `/volume1/drives/{driveId}`), (b) 환경변수 `STORAGE_DRIVE_ROOT` + driveId 조합으로 service 가 생성 | **(b)** — 운영/로컬 NAS 경로 차이를 env 로 분리. service 가 INSERT 시점에 `${root}/${driveId}` 로 생성. hardcoded 경로 금지 |
| **D2** | iSCSI portal IP/port 노출 | (a) API 응답에 plain text 포함, (b) `.ps1` 템플릿에만 inline | **(a) + (b)** — UI 가이드 카드에 *portal 주소를 명시*하고 (`.ps1` 자체 실행 못 할 환경 대비), 동시에 `.ps1` 내부에도 inline. env: `STORAGE_AGENT_PORTAL_HOST` (예: `192.168.0.5:3260`) |
| **D3** | `.ps1` 다운로드 endpoint 위치 | (a) `GET /api/mount-credentials/:id/script.ps1` (응답 `text/plain` + `Content-Disposition: attachment`), (b) UI 가 응답 JSON 으로 받은 자격증명을 client 측 string interpolation 으로 조립 | **(a)** — server 가 권위 있는 source of truth. 가이드 템플릿 수정 시 client 재빌드 불필요. `Content-Type: application/x-powershell; charset=utf-8` |
| **D4** | revoke 시 agent target 삭제 정책 | (a) DB soft-revoke 만 + 별도 cleanup 잡, (b) revoke 시 **즉시** `storageAgentClient.deleteTarget(iqn)` 호출 + 실패 시 `STORAGE_AGENT_*` 전파 | **(b)** — 가설 검증 phase 의 마찰 ↓. agent 실패 시 사용자가 즉시 알아채야 함. 별도 cleanup 잡은 Phase 5 multi-tenant 에서 |
| **D5** | mountPath 디렉토리 생성 책임 | (a) `storage-agent` 가 책임 (현재 contract 외), (b) API 가 host OS 에 *간접*으로 만들 방법 없음 → **v1.0 은 본인이 사전 생성** + plan README 에 명시 | **(b)** — Phase 3 scope 안에 host filesystem 조작을 추가하지 않음. drives 의 `mountPath` 는 본인이 DSM 에서 사전 생성한 share location 을 가리킨다는 것을 plan/PRD 에 명시. host fs 자동화는 v1.x 의 agent contract 확장과 묶음 |
| **D6** | drive ownership / RBAC | (a) JWT user = ownerId 만 read/write, (b) `share_grants` 검증까지 본 phase 에 포함 | **(a)** — `share_grants` 사용은 Phase 5. 본 phase 는 `req.user.id !== drive.ownerId` 시 `DRIVE_FORBIDDEN` 즉시 throw |
| **D7** | mount-credential 만료 정책 | (a) v1.0 무기한 (`revokedAt IS NULL` = active), (b) 자동 만료 30/90일 | **(a)** — 본인 1인 검증이라 자동 만료는 noise. v1.1 의 가족 multi-tenant 에서 도입 |

---

## UX Design

### Page 구조 (services/web)

```
/drive  (기존 pages/drive)
└── widgets/drive-mount-panel (신규 widget)
    ├── 발급 카드
    │   ├── "내 드라이브 마운트" 헤더
    │   ├── 활성 자격증명 0건 → "마운트 발급" 버튼 (features/mount-credential-issue)
    │   └── 활성 자격증명 1건+ → 카드 목록 + 회수 버튼 (features/mount-credential-revoke)
    └── 발급 직후 1회용 다이얼로그 (features/mount-credential-issue 의 결과 UI)
        ├── CHAP username (read-only, copy 버튼)
        ├── CHAP password (read-only, 마스킹/노출 토글, copy 버튼)
        ├── IQN (read-only, copy)
        ├── Portal 주소 (read-only, copy)
        ├── ".ps1 다운로드" 버튼 → /api/mount-credentials/:id/script.ps1
        └── "확인했습니다" 닫기 버튼 (이후 비밀번호 재조회 불가 warning)
```

### 시각 어휘 (mobile-ui-guide v1.0)

- *모든 UI 토큰은 [mobile-ui-guide §6.2 token utility](../../.claude/rules/ecc/web/mobile-ui-guide.md) 만 사용*. catalyst import 금지 — 신규 컴포넌트는 `shared/ui/{component}/` headless 우선
- 1회용 다이얼로그는 **modal bottom sheet on mobile, centered dialog on desktop** (mobile-ui-guide §2.2 Modal anatomy). 본 phase 작업자가 직접 만들지 말고 *현재 사용 가능한 가장 가까운 headless modal* 이 있다면 재사용, 없으면 PR 작성자가 [PRD design-system-v1 Milestone 2](../prds/design-system-v1.prd.md) 와 마찰 없는 최소 modal 만 작성
- CHAP password 의 노출/마스킹 토글은 `aria-pressed` 로 상태 노출 — mobile-ui-guide §4.3 ARIA. password 텍스트는 `font-mono` + `select-all`
- "이 비밀번호는 다시 볼 수 없습니다" 메시지는 `text-danger` + 충분한 spacing — backup-code feature 의 메시지 톤과 일치

### 가이드 카드 (단일 다이얼로그) 시각 anatomy

| 영역 | 내용 |
|---|---|
| Header | "마운트 자격증명이 발급되었습니다" + drive name |
| Warning banner | "비밀번호는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요." (`text-danger-soft` 배경 + `text-danger-fg`) |
| Credential table | username / password (마스킹 토글) / IQN / Portal — 각 행 우측에 copy 버튼 |
| Script download CTA | "Windows .ps1 다운로드" — primary button, accent color |
| Manual command snippet | `.ps1` 을 실행 못 할 때 직접 붙여넣을 PowerShell 3줄 (`New-IscsiTargetPortal`, `Connect-IscsiTarget`, `Get-Disk \| Set-Disk` 등) — code 블록 형태 |
| Acknowledge button | "닫기 — 다시 표시되지 않습니다" |

> 시각 anatomy 는 본 plan 의 *최소 합의*. 실제 layout/spacing 은 mobile-ui-guide §5 (위계는 scale & whitespace) + §2.1 (touch target 48dp) 을 그대로 적용

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [.claude/prds/network-storage-reframing.prd.md](../prds/network-storage-reframing.prd.md) §"User Flow (Critical Path)" + §"Core Capabilities (MoSCoW)" | Phase 3 의 surface 가 정확히 어디인지의 1차 출처 |
| P0 | [phase1-sot-adr-schema](network-storage-reframing-phase1-sot-adr-schema.plan.md) Task 4~6 | drives / mount_credentials / share_grants 컬럼 형상 — 본 phase 의 INSERT/UPDATE 가 따를 contract |
| P0 | [phase2-sidecar-agent](network-storage-reframing-phase2-sidecar-agent.plan.md) §"Resolved Decisions" + Task 7 | `CreateTargetRequest = { iqn, name, osUsername, osPassword }` wire-format — Phase 3 가 그대로 호출 |
| P0 | [services/api/src/storage-agent/storage-agent.client.ts](../../services/api/src/storage-agent/storage-agent.client.ts) + [storage-agent.types.ts](../../services/api/src/storage-agent/storage-agent.types.ts) | 호출 시그니처와 ErrorCode 매핑 — 본 phase 의 service 가 wrap |
| P0 | [docs/spikes/phase0-steam-network-storage.md](../../docs/spikes/phase0-steam-network-storage.md) §"Track A — iSCSI" | DSM SAN Manager 의 IQN/Target/LUN 매핑 패턴. `.ps1` 가이드의 정확한 PowerShell cmdlet 순서 reference |
| P0 | [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"Swagger / DTO 컨벤션" + §"오류 추가 절차" | controller 데코레이터 순서 + ErrorCode 등록 절차. 위반 시 PR review reject |
| P0 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) §"아키텍처 개요" + §"신규 슬라이스 생성 시 체크리스트" + §"API 레이어 / TanStack Query × Zustand 컨벤션" | FSD layer/segment 결정 흐름 + codegen 워크플로 |
| P0 | [.claude/rules/ecc/web/mobile-ui-guide.md](../../.claude/rules/ecc/web/mobile-ui-guide.md) §1~§8 | 모든 UI 작업의 1차 출처 — catalyst 차단 + token utility + a11y + trend curation |
| P0 | [services/web/src/features/backup-code/](../../services/web/src/features/backup-code/) 전체 슬라이스 | 1회 표시 + 절대 재조회 불가 + 안전 보관 경고 UX 의 가장 가까운 mirror. `useBackupCode` 의 `generatedCodes`/`clearGeneratedCodes` 패턴 그대로 적용 |
| P1 | [services/api/src/twofa/](../../services/api/src/twofa/) | controller + service + repository + DTO + module 의 모범 구조 |
| P1 | [services/api/src/file/](../../services/api/src/file/) | upload-session 같은 lifecycle entity 의 status 컬럼 패턴 — mount_credentials `revokedAt` 처리에 reference |
| P1 | [services/web/src/features/file-upload/](../../services/web/src/features/file-upload/) | mutation + model + ui 3-segment 의 모범 — codegen wrapper 패턴 |
| P1 | [services/web/src/entities/file/](../../services/web/src/entities/file/) | entity slice 의 types/index 패턴 |
| P1 | [docs/adr/0003-storage-sot-nas-filesystem.md](../../docs/adr/0003-storage-sot-nas-filesystem.md) + [docs/adr/0004-iscsi-priority-smb-deferred.md](../../docs/adr/0004-iscsi-priority-smb-deferred.md) | 본 phase 가 따라야 할 architectural 결정 — SMB endpoint 추가 금지 (ADR-0004) |
| P2 | [.claude/rules/ecc/common/security.md](../../.claude/rules/ecc/common/security.md) §"Secret Management" + [typescript/security.md](../../.claude/rules/ecc/typescript/security.md) | 평문 비밀 처리 정책 |
| P2 | [.claude/rules/ecc/common/logging.md](../../.claude/rules/ecc/common/logging.md) §"Never Log" | 발급/회수 이벤트 로깅 시 password 절대 노출 금지 |
| P2 | memory `project_auth_lifecycle_resolved` (인접) + `project_design_system_v1_phase2_dogfood` | 직전 PR 의 UI 톤 (다크모드 + 2FA UI 재설계) — 본 phase UI 가 그 톤과 일관 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Windows iSCSI Initiator PowerShell | https://learn.microsoft.com/en-us/powershell/module/iscsi/ | `New-IscsiTargetPortal -TargetPortalAddress` + `Connect-IscsiTarget -NodeAddress <iqn> -IsPersistent $true -AuthenticationType ONEWAYCHAP -ChapUsername <user> -ChapSecret <pw>` |
| iSCSI Initiator 자동 시작 | https://learn.microsoft.com/en-us/powershell/module/msdsc-initiator/ | `Set-Service -Name MSiSCSI -StartupType Automatic; Start-Service MSiSCSI` — `.ps1` 의 첫 줄 |
| Synology DSM SAN Manager CHAP | DSM 7 SAN Manager docs | mutual CHAP 까지는 v1.0 불요. one-way CHAP (target → initiator) 만 — synowebapi 가 정확히 그 형식을 받음 |
| Drizzle bigint mode | https://orm.drizzle.team/docs/column-types/pg#bigint | `quotaBytes` 는 `mode: 'number'` — JS number 의 53bit 한계 안에 들어옴 (terab 단위 미만) |
| NestJS file download | https://docs.nestjs.com/techniques/streaming-files | `StreamableFile` + `@Header('Content-Disposition', ...)`. 본 phase 는 text 파일이라 string + Response 직접 조작도 가능 |
| hey-api codegen | 코드베이스 `services/web/package.json` 의 `openapi:codegen` script | 본 phase 의 새 endpoint 가 등록되면 web 측 mutation/query 자동 생성 |

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| API 모듈 골격 (controller + service + repository + DTO + module) | [services/api/src/twofa/](../../services/api/src/twofa/) | 신규 `DriveModule`, `MountCredentialModule` 의 1:1 reference |
| Controller 데코레이터 순서 | [services/api/CLAUDE.md §"메서드 데코레이터 순서 (고정)"](../../services/api/CLAUDE.md) | `@Throttle → HTTP verb → @HttpCode → @ApiOperation → @ApiResponse → @ApiError` — 위반 시 reject |
| ErrorCode 추가 | [services/api/src/common/exceptions/error-code.enum.ts](../../services/api/src/common/exceptions/error-code.enum.ts) `STORAGE_AGENT_*` 4개 | `DRIVE_*`, `MOUNT_CREDENTIAL_*` 신규 키 추가 절차 |
| ServiceCore + auto-trace | [services/api/src/file/file.service.ts](../../services/api/src/file/file.service.ts) | `extends ServiceCore` — public 메서드 자동 트레이스. business event 만 `@InjectPinoLogger` 명시 |
| repository pattern (feature-keyed) | [services/api/src/file/file.repository.ts](../../services/api/src/file/file.repository.ts) + memory `project_repository_pattern` | `findByOwnerId`, `findActiveByDriveId` 같은 feature 키. 여러 테이블 join 허용 |
| Web FSD entity slice | [services/web/src/entities/file/](../../services/web/src/entities/file/) | `model/types.ts` + `index.ts` re-export. 신규 `entities/drive`, `entities/mount-credential` 동일 골격 |
| Web FSD feature slice | [services/web/src/features/file-upload/](../../services/web/src/features/file-upload/) | `api/mutation.ts` (codegen wrapper) + `model/useUpload.ts` (composition) + `ui/UploadButton.tsx`. `api/` 는 슬라이스 barrel 에서 미노출 |
| 1회 표시 + 닫기 UX | [services/web/src/features/backup-code/](../../services/web/src/features/backup-code/) `useBackupCode` + `BackupCodeSection` | `generatedCodes` 상태 + `clearGeneratedCodes` 명시 + 경고 메시지. 본 phase 의 `useMountCredentialIssue` 가 동일 shape |
| 가이드 다운로드 (서버 권위 source) | (코드베이스 직접 사례 없음 — 새 패턴) | NestJS `@Header()` 데코레이터 + 응답 type `string` + Content-Disposition |
| Web modal/dialog | mobile-ui-guide §2.2 Modal anatomy + §7.1 elevation | mobile = BottomSheet, desktop = centered dialog. catalyst dialog import 금지 |
| codegen wrapper | services/web/CLAUDE.md §"codegen 도입 후 api/ 세그먼트 규칙" | mutation wrapper + queryClient invalidation onSuccess. queryKey 수동 작성 금지 |
| password 1회 노출 wire-format | (코드베이스 사례 없음 — backup-code 는 발급 응답에 codes array 포함) | DTO: `IssueMountCredentialResponseDto.password: string` (응답 1회만) vs `MountCredentialDto.password: never` (조회 시 미포함) — discriminated DTO 2종 분리 |

---

## Files to Create / Update

### API — drives module (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/src/drive/drive.module.ts` | CREATE | CRLF | `@Module` |
| `services/api/src/drive/drive.controller.ts` | CREATE | CRLF | `GET /api/drives/me` (본인 personal drive 조회 — 없으면 lazy 생성) + `GET /api/drives/:id` |
| `services/api/src/drive/drive.controller.spec.ts` | CREATE | CRLF | controller 단위 테스트 |
| `services/api/src/drive/drive.service.ts` | CREATE | CRLF | `ensurePersonalDrive(userId)` (R6 lazy) + `findByIdOrThrow(id, userId)` (D6 ownership) |
| `services/api/src/drive/drive.service.spec.ts` | CREATE | CRLF | service 단위 |
| `services/api/src/drive/drive.repository.ts` | CREATE | CRLF | feature-keyed (`findPersonalByOwnerId`, `create`) |
| `services/api/src/drive/drive.repository.spec.ts` | CREATE | CRLF | repository 단위 |
| `services/api/src/drive/dto/drive.dto.ts` | CREATE | CRLF | response DTO: id/name/kind/mountPath/createdAt |
| `services/api/src/drive/index.ts` | CREATE | CRLF | barrel — `DriveService`, `DriveModule` |

### API — mount-credential module (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/src/mount-credential/mount-credential.module.ts` | CREATE | CRLF | imports: `DriveModule`, `StorageAgentModule` |
| `services/api/src/mount-credential/mount-credential.controller.ts` | CREATE | CRLF | `POST /api/mount-credentials` (issue) + `GET /api/mount-credentials` (list by current user) + `DELETE /api/mount-credentials/:id` (revoke) |
| `services/api/src/mount-credential/mount-credential.controller.spec.ts` | CREATE | CRLF | controller 단위 |
| `services/api/src/mount-credential/mount-credential.service.ts` | CREATE | CRLF | `issue` (CHAP secret 생성 + Docker Secret 등록 + agent.createTarget + DB insert + 1회 응답) / `revoke` (agent.deleteTarget + Docker Secret 제거 + DB revokedAt 갱신) / `renderScript` (가이드 템플릿 fill) / `listActive(userId)` |
| `services/api/src/mount-credential/mount-credential.service.spec.ts` | CREATE | CRLF | service 단위 — agent client + secret store 둘 다 mock |
| `services/api/src/mount-credential/mount-credential.repository.ts` | CREATE | CRLF | feature-keyed (`findActiveByUserId`, `findByIdAndUserId`, `softRevoke`, `insertIssued`) |
| `services/api/src/mount-credential/mount-credential.repository.spec.ts` | CREATE | CRLF | repository 단위 |
| `services/api/src/mount-credential/secret-store.ts` | CREATE | CRLF | Docker Secret 등록/제거 abstraction (interface + env-driven impl). v1.0 은 file-based — `/run/secrets/` 디렉토리 write. dev 는 tmp 디렉토리 fallback |
| `services/api/src/mount-credential/secret-store.spec.ts` | CREATE | CRLF | 단위 — happy path + 권한 실패 + cleanup |
| `services/api/src/mount-credential/script-template.ts` | CREATE | CRLF | `.ps1` 템플릿 함수 (taggedTemplate or simple replace). credentials/IQN/portal 채움 |
| `services/api/src/mount-credential/dto/issue-mount-credential.dto.ts` | CREATE | CRLF | request: `{ driveId: string }` (옵션 — 본인 personal drive 기본값) |
| `services/api/src/mount-credential/dto/mount-credential.dto.ts` | CREATE | CRLF | response: id/driveId/protocol/osUsername/iqn/portalHost/portalPort/createdAt — password 미포함 |
| `services/api/src/mount-credential/dto/issue-mount-credential-response.dto.ts` | CREATE | CRLF | response (1회용): MountCredentialDto + `password: string` + `script: string` — 발급 응답에만 포함 (D3 (B) 결정) |
| `services/api/src/mount-credential/index.ts` | CREATE | CRLF | barrel |

### API — 공통 갱신

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/src/common/exceptions/error-code.enum.ts` | UPDATE | (보존) | `DRIVE_NOT_FOUND`, `DRIVE_FORBIDDEN`, `MOUNT_CREDENTIAL_NOT_FOUND`, `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL` (Phase 1 의 unique 제약 위반 시), `MOUNT_CREDENTIAL_REVOKED`, `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED` 추가 |
| `services/api/src/app.module.ts` | UPDATE | (보존) | `imports: [..., DriveModule, MountCredentialModule]` |
| `api.env.example` | UPDATE | (보존) | `STORAGE_DRIVE_ROOT=/volume1/drives` + `STORAGE_AGENT_PORTAL_HOST=192.168.0.5` + `STORAGE_AGENT_PORTAL_PORT=3260` + `STORAGE_SECRET_DIR=/run/secrets` 추가 |

### Web — entity slices (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/web/src/entities/drive/model/types.ts` | CREATE | CRLF | `Drive` type — codegen DTO re-export 또는 inline (mirror: entities/file/model/types.ts) |
| `services/web/src/entities/drive/index.ts` | CREATE | CRLF | barrel |
| `services/web/src/entities/mount-credential/model/types.ts` | CREATE | CRLF | `MountCredential` type — password 필드 없음 (보안) |
| `services/web/src/entities/mount-credential/index.ts` | CREATE | CRLF | barrel |
| `services/web/src/entities/index.ts` | UPDATE | (보존) | `export * from './drive'` + `export * from './mount-credential'` 추가 |

### Web — feature slices (신규)

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/web/src/features/mount-credential-issue/api/mutation.ts` | CREATE | CRLF | hey-api `issueMountCredentialMutation` wrapper + queryClient.invalidateQueries onSuccess |
| `services/web/src/features/mount-credential-issue/model/useIssueMountCredential.ts` | CREATE | CRLF | mutation 호출 + `issued` state (password 포함 1회용) + `clearIssued` action — backup-code `useBackupCode` mirror |
| `services/web/src/features/mount-credential-issue/model/useIssueMountCredential.test.tsx` | CREATE | CRLF | 훅 단위 — issue 성공/실패/clearIssued |
| `services/web/src/features/mount-credential-issue/ui/IssueMountCredentialButton.tsx` | CREATE | CRLF | "마운트 발급" 트리거 버튼 + 발급 후 다이얼로그 (1회용 CHAP secret + `.ps1` 다운로드 링크) |
| `services/web/src/features/mount-credential-issue/ui/IssueMountCredentialButton.test.tsx` | CREATE | CRLF | 컴포넌트 단위 — 다이얼로그 열림/copy 버튼/다운로드 링크 |
| `services/web/src/features/mount-credential-issue/index.ts` | CREATE | CRLF | barrel (api 미노출) |
| `services/web/src/features/mount-credential-revoke/api/mutation.ts` | CREATE | CRLF | hey-api `revokeMountCredentialMutation` wrapper |
| `services/web/src/features/mount-credential-revoke/model/useRevokeMountCredential.ts` | CREATE | CRLF | mutation 호출 + confirm 흐름 |
| `services/web/src/features/mount-credential-revoke/model/useRevokeMountCredential.test.tsx` | CREATE | CRLF | 훅 단위 |
| `services/web/src/features/mount-credential-revoke/ui/RevokeMountCredentialButton.tsx` | CREATE | CRLF | "회수" 버튼 + 확인 다이얼로그 |
| `services/web/src/features/mount-credential-revoke/ui/RevokeMountCredentialButton.test.tsx` | CREATE | CRLF | 컴포넌트 단위 |
| `services/web/src/features/mount-credential-revoke/index.ts` | CREATE | CRLF | barrel |
| `services/web/src/features/index.ts` | UPDATE | (보존) | 2개 신규 슬라이스 re-export |

### Web — widget + page 확장

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/web/src/widgets/drive-mount-panel/ui/DriveMountPanel.tsx` | CREATE | CRLF | 활성 자격증명 목록 + 발급 버튼 + 회수 버튼 조합. 자체 비즈니스 로직 0 (services/web/CLAUDE.md §"Widgets vs Features") |
| `services/web/src/widgets/drive-mount-panel/ui/DriveMountPanel.test.tsx` | CREATE | CRLF | 컴포넌트 단위 — features mock |
| `services/web/src/widgets/drive-mount-panel/index.ts` | CREATE | CRLF | barrel |
| `services/web/src/widgets/index.ts` | UPDATE | (보존) | `export * from './drive-mount-panel'` |
| `services/web/src/pages/drive/ui/{기존 페이지 파일}` | UPDATE | (보존) | `<DriveMountPanel />` 추가 — 정확한 파일명은 작업 시작 시 `ls services/web/src/pages/drive/ui/` 로 확인 |

### Web — codegen + 공통

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/web/src/shared/api/generated/**` | UPDATE (auto) | (codegen 출력) | `npm run openapi:codegen` 후 생성된 mutation/query 함수 — 수동 편집 금지 |

### E2E + plan/PRD 갱신

| File | Action | EOL | Justification |
|---|---|---|---|
| `services/api/test/mount-credential.e2e-spec.ts` | CREATE | CRLF | fakedsm 기반 agent + JWT 인증 + 발급 → list → revoke round-trip. Phase 2 의 `storage-agent.e2e-spec.ts` 와 동일 fixture 재사용 |
| `.claude/prds/network-storage-reframing.prd.md` | UPDATE | (보존) | Phase 3 row status `pending` → `in-progress` → `complete` + PRP 컬럼에 본 plan 경로 |

> 본 PR 의 diff 에 `services/api/src/file/**`, `services/api/src/folder/**` 변경 0줄. share-grants 관련 코드 변경 0줄 (Phase 5 책임). 기존 `drives`/`mount_credentials` schema 변경 0줄 (Phase 1 산출물 유지)

## NOT Building

- **가족 사용자 발급 / multi-tenant**: drive ownership 검증은 본인 단일 사용자 전제. `share_grants` 테이블은 schema 만 존재하고 본 phase 의 controller 가 참조하지 않음 — Phase 5
- **모바일 HTTP File API 통합**: 본 phase 는 마운트 발급 한정. drive 의 파일/폴더 시각화는 Phase 6 의 SoT 이전과 묶음
- **drive 자동 quota 강제**: schema 의 `quotaBytes` 컬럼만 존재. 강제 검증은 v1.1
- **SMB 발급**: ADR-0004 결정 — agent 인터페이스에도 endpoint 없음
- **CHAP secret 자동 회전**: 발급 후 무기한 유효. 회전은 v1.1
- **mountPath 디렉토리 자동 생성**: D5 결정대로 본인이 DSM 에서 사전 생성. plan README 에 명시
- **share-grants service 사용**: 본 phase 의 `DRIVE_FORBIDDEN` 분기는 ownership 만 검사 — share-grants 조회 0건
- **다국어 UI**: 한국어 only. i18n 도입은 v1.x
- **modal headless 컴포넌트 신규 작성**: PRD design-system-v1 Milestone 2 와 *경계 충돌* — 본 phase 가 modal 을 처음으로 필요로 한다면 minimal headless 만 작성하고 Milestone 2 에서 정식화. 만약 디자인 시스템 v1.0 의 modal 이 이미 들어와 있으면 그대로 재사용
- **별도 `.ps1` 다운로드 endpoint**: D3 → (B) 결정으로 issue 응답 본문에 `script: string` 1회 포함. `GET /api/mount-credentials/:id/script.ps1` endpoint 신설 안 함 (별도 단명 token + Redis TTL 인프라 회피)
- **Logging dashboard / 마운트 세션 모니터링**: PRD Should-have 의 "마운트 세션 모니터링" 은 Phase 5 또는 별도 phase

---

## Step-by-Step Tasks

### Task 1 — ErrorCode + env.example 갱신

- **ACTION**:
  - `services/api/src/common/exceptions/error-code.enum.ts` 에 6개 키 추가 (`DRIVE_NOT_FOUND`, `DRIVE_FORBIDDEN`, `MOUNT_CREDENTIAL_NOT_FOUND`, `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL`, `MOUNT_CREDENTIAL_REVOKED`, `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED`)
  - `api.env.example` 에 4개 변수 추가 (`STORAGE_DRIVE_ROOT`, `STORAGE_AGENT_PORTAL_HOST`, `STORAGE_AGENT_PORTAL_PORT`, `STORAGE_SECRET_DIR`)
- **MIRROR**: 기존 `STORAGE_AGENT_*` 4종 등록 형식
- **VALIDATE**:
  - `grep -E "DRIVE_FORBIDDEN|MOUNT_CREDENTIAL_REVOKED" services/api/src/common/exceptions/error-code.enum.ts` → 2 매치
  - `grep "STORAGE_DRIVE_ROOT" api.env.example` → 1 매치

### Task 2 — DriveModule 골격 (TDD)

- **ACTION**: `services/api/src/drive/` 6개 파일 + `AppModule.imports` 등재
- **MIRROR**: `services/api/src/twofa/` 구조
- **TDD**:
  1. **RED**: `drive.repository.spec.ts` — `findPersonalByOwnerId(uuid)` 미존재 시 `null`, 존재 시 row 반환
  2. **GREEN**: repository 구현 (drizzle select + `kind = 'PRIVATE'` 필터)
  3. **RED**: `drive.service.spec.ts` — `ensurePersonalDrive(userId)` 가 없으면 INSERT 후 row 반환, 있으면 기존 row 반환. `findByIdOrThrow(driveId, userId)` 가 ownership 불일치 시 `DRIVE_FORBIDDEN`
  4. **GREEN**: service 구현 (D6 ownership 분기) + `mountPath = ${process.env.STORAGE_DRIVE_ROOT}/${driveId}`
  5. **RED**: `drive.controller.spec.ts` — `GET /api/drives/me` 정상 응답
  6. **GREEN**: controller 구현 + DTO + Swagger 데코레이터
- **VALIDATE**:
  - `npm test --workspace=services/api -- drive` 통과
  - `npm run start:dev --workspace=services/api` 후 `curl -H "Authorization: Bearer <jwt>" http://localhost:3000/api/drives/me` → 200 + drive row
  - `services/api/src/drive/index.ts` barrel 존재 + AppModule import

### Task 3 — secret-store 추상화 (file-based)

- **ACTION**: `services/api/src/mount-credential/secret-store.ts` — interface + 환경변수 기반 file impl
- **CONTENT 가이드**:
  - `interface SecretStore { write(name: string, value: string): Promise<string>; remove(name: string): Promise<void>; }`
  - file impl: `${process.env.STORAGE_SECRET_DIR}/${name}` (production = `/run/secrets/...`, dev = `${os.tmpdir()}/terab-secrets`)
  - 권한: `fs.writeFile` + `chmod 0600`. 실패 시 `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED`
  - **로깅 시 secret 값 절대 노출 금지** ([common/logging.md §"Never Log"](../../.claude/rules/ecc/common/logging.md))
- **TDD**:
  1. **RED**: `secret-store.spec.ts` — write 후 정확한 경로 + 권한, remove 후 파일 부재, write 실패 시 throw
  2. **GREEN**: 구현
- **VALIDATE**:
  - `grep -iE "(plaintext|password|secret_value)" services/api/src/mount-credential/secret-store.ts` 가 변수 이름 외 0건
  - `chmod 0600` 호출 존재
  - dev 환경에서 `tmp` fallback 동작 (테스트 fixture 로 검증)

### Task 4 — script-template (`.ps1` 렌더링)

- **ACTION**: `services/api/src/mount-credential/script-template.ts` — `renderPowerShellMountScript(args)` 함수
- **CONTENT 가이드**:
  - args: `{ portalHost, portalPort, iqn, chapUsername, chapPassword, driveLetter?: 'Z' }`
  - 출력 형식 (대략):
    ```powershell
    Set-Service -Name MSiSCSI -StartupType Automatic
    Start-Service MSiSCSI
    New-IscsiTargetPortal -TargetPortalAddress "{{portalHost}}" -TargetPortalPortNumber {{portalPort}}
    Connect-IscsiTarget -NodeAddress "{{iqn}}" -IsPersistent $true `
      -AuthenticationType ONEWAYCHAP -ChapUsername "{{chapUsername}}" -ChapSecret "{{chapPassword}}"
    # 신규 디스크 자동 온라인 (이미 partition 된 경우 skip)
    Get-Disk | Where-Object { $_.OperationalStatus -eq 'Offline' } | Set-Disk -IsOffline $false
    ```
  - escape: PowerShell single quote (`'`) 안에서는 `''` 로 두 번. 본 phase 는 double quote + backtick escape 으로 통일 — secret 안의 `"` 는 `\"` 가 아닌 `""` (PowerShell 규칙)
  - header 주석에 발급 시각 + drive name 포함 (PowerShell 주석은 `#`)
- **TDD**:
  1. **RED**: `script-template.spec.ts` — args 4종으로 호출 시 정확한 텍스트 (snapshot 또는 line 단위 매칭). password 에 `"` 가 포함된 경우 escape 검증
  2. **GREEN**: 구현
- **VALIDATE**:
  - `grep "{{" services/api/src/mount-credential/script-template.ts` 가 0건 (placeholder 미치환 시 0건이어야 함 — template literal interpolation 사용)
  - 테스트가 PowerShell special character escape 검증 (`"`, `` ` ``, `$`)

### Task 5 — MountCredentialModule core (issue + revoke + list)

- **ACTION**: repository + service + DTO + controller + spec
- **MIRROR**: twofa 의 controller/service 구조 + storage-agent.client 의 호출 패턴
- **TDD 순서**:
  1. **RED**: `mount-credential.repository.spec.ts` — `findActiveByUserId(uuid)` (revokedAt IS NULL), `findByIdAndUserId(id, uuid)`, `softRevoke(id, now)`, `insertIssued(dto)`. 동일 `(driveId, userId, protocol)` 중복 시 unique 위반 → service 가 `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL` 로 변환
  2. **GREEN**: repository 구현
  3. **RED**: `mount-credential.service.spec.ts` — `issue(userId, driveId?)` 가 (a) drive 검증, (b) CHAP username/password 생성(`crypto.randomBytes(16).toString('base64url')` — special character escape risk 0), (c) secret store write, (d) `storageAgentClient.createTarget(iqn, name, osUsername, osPassword)` 호출, (e) DB insert, (f) password + script 포함 1회 응답. 실패 path: agent error → secret rollback (이미 쓴 secret remove) → throw
  4. **GREEN**: service 구현. **iqn 생성 규칙**: `iqn.2026-05.com.terab:${driveId}` (Phase 2 Open Decision D-B)
  5. **RED**: `revoke(userId, credentialId)` 가 agent.deleteTarget → secret remove → softRevoke. agent NOT_FOUND 도 idempotent 처리 (이미 회수된 case 신중)
  6. **GREEN**: 구현
  7. **RED**: controller spec — `POST /api/mount-credentials` 201 + password+script 포함, `GET /api/mount-credentials` 활성 list (password/script 미포함), `DELETE /api/mount-credentials/:id` 204
  8. **GREEN**: controller 구현 + Swagger. issue 응답 DTO 에 `password`, `script` 필드 `@ApiProperty()` 명시 (codegen 누락 방지)
- **VALIDATE**:
  - `npm test --workspace=services/api -- mount-credential` 통과
  - issue 응답 DTO type 에 `password: string` + `script: string`, 조회 응답 DTO type 에 두 필드 모두 부재
  - `grep "password" services/api/src/mount-credential/mount-credential.service.spec.ts` 가 변수/필드 이름만 — 평문 password 가 로그 호출 인자에 직접 노출 0건
  - issue 실패 시 secret rollback 호출 검증 (mock spy)

### Task 6 — Web entity slice 2개 + codegen 재생성

- **ACTION**: `entities/drive`, `entities/mount-credential` slice + `npm run openapi:codegen`
- **MIRROR**: `entities/file/`
- **순서**:
  1. API 측 Task 1~5 완료 + dev 서버 reload
  2. `npm --prefix services/web run openapi:codegen` — generated mutation/query 함수 자동 출력
  3. generated diff 검토 (수정 금지). issue response type 에 `password`, `script` 필드 존재 확인
  4. `entities/drive/model/types.ts` 에서 generated DTO type 을 import 후 `Drive` re-export
  5. `entities/mount-credential/model/types.ts` 동일
  6. 각 slice 의 `index.ts` 및 `entities/index.ts` 갱신
- **VALIDATE**:
  - `npx tsc --noEmit -p services/web/tsconfig.app.json` 통과
  - generated 에 `issueMountCredentialMutation`, `getMountCredentialsOptions`, `revokeMountCredentialMutation`, `getDrivesMeOptions` 4개 존재 (이름은 hey-api 자동)

### Task 7 — Web feature slice 2개 (TDD)

- **ACTION**: `features/mount-credential-issue`, `features/mount-credential-revoke`
- **MIRROR**: `features/backup-code/` 의 `useBackupCode` + `BackupCodeSection`, `features/file-upload/` 의 mutation wrapper
- **TDD 순서**:
  1. **RED**: `useIssueMountCredential.test.tsx` — `issue()` 호출 시 mutation 실행, 성공 시 `issued` state 에 (script, password, ...) 저장, `clearIssued()` 호출 시 state 비움
  2. **GREEN**: `useIssueMountCredential.ts` 구현
  3. **RED**: `IssueMountCredentialButton.test.tsx` — 클릭 시 mutation 트리거, 성공 후 다이얼로그 노출, "다운로드" 클릭 시 `Blob` 생성 + 클릭, "닫기" 클릭 시 `clearIssued` 호출 + 다이얼로그 닫힘
  4. **GREEN**: 컴포넌트 구현 (mobile-ui-guide §6.2 token utility, catalyst import 0). client-side `.ps1` 다운로드: `new Blob([script], { type: 'application/x-powershell' })` + `URL.createObjectURL` + 자동 click
  5. **RED**: `useRevokeMountCredential.test.tsx` — `revoke(id)` 호출 시 mutation 실행 + 성공 시 list query invalidation
  6. **GREEN**: 구현
  7. **RED**: `RevokeMountCredentialButton.test.tsx` — confirm 다이얼로그, 회수 후 onSuccess 콜백
  8. **GREEN**: 구현
- **VALIDATE**:
  - `npm test --workspace=services/web -- mount-credential` 통과
  - `grep -r "from '@/shared/ui/catalyst'" services/web/src/features/mount-credential-*` → 0건 (mobile-ui-guide §8.2)
  - 각 slice 의 `index.ts` 에 `api/` export 0건
  - `model` 이 `@shared/api` 의 codegen 함수 직접 import 0건

### Task 8 — widget + page 확장

- **ACTION**:
  - `widgets/drive-mount-panel/ui/DriveMountPanel.tsx` 생성 — `useGetDrivesMeQuery` 로 personal drive 조회 + `useGetMountCredentialsQuery` 로 활성 list + `IssueMountCredentialButton` + `RevokeMountCredentialButton` 조합. 자체 비즈니스 로직 0
  - `pages/drive/ui/{기존 페이지}` 에 `<DriveMountPanel />` 추가 (위치는 작업자가 디자인 흐름 판단)
- **TDD**:
  1. **RED**: `DriveMountPanel.test.tsx` — features mock + 자격증명 0건/1건/3건 케이스의 시각 ARIA + a11y axe
  2. **GREEN**: 구현
- **VALIDATE**:
  - widget 안에서 `api/` 디렉토리 0건 (widget 은 자체 API 호출 금지 — services/web/CLAUDE.md §"Widgets vs Features")
  - axe-core 단위 a11y 통과 (mobile-ui-guide §4.4 acceptance gate)
  - keyboard navigation: Tab → 발급 버튼 → revoke 버튼 → 다이얼로그 안 trap 검증 (수동 또는 jsdom)

### Task 9 — E2E + manual smoke + PRD/plan 갱신

- **ACTION**:
  - `services/api/test/mount-credential.e2e-spec.ts` — fakedsm 기반 agent fixture 재사용 + JWT 인증 + `POST /api/mount-credentials` → `GET /api/mount-credentials` → `DELETE /api/mount-credentials/:id` 라운드트립
  - 본인 환경에서 manual smoke: web UI → 발급 → `.ps1` 다운로드 → PC 에서 실행 → `Get-Disk` 로 새 디스크 확인 → 회수 후 disk 사라짐 확인
  - PRD Phase 3 row status → `complete` + PRP 컬럼에 본 plan 경로
  - 본 plan frontmatter `status` → `done`
- **VALIDATE**:
  - `STORAGE_AGENT_E2E=1 npm run test:e2e --workspace=services/api -- mount-credential` 통과
  - manual smoke 결과를 본 plan 의 Notes 또는 별도 short report 에 1단락 기록
  - `grep "phase3-self-issuance-ui" .claude/prds/network-storage-reframing.prd.md` → 1건

---

## Validation Commands

### API 단위 + 타입
```bash
cd services/api
npx tsc --noEmit
npm test -- drive
npm test -- mount-credential
npm test -- secret-store
npm test -- script-template
```
EXPECT: 모두 exit 0. 커버리지 ≥ 80% (`npm test -- --coverage`).

### codegen + Web 타입
```bash
# API dev 서버 켠 상태에서
npm --prefix services/web run openapi:codegen
npm --prefix services/web run typecheck
npm --prefix services/web test -- mount-credential
npm --prefix services/web test -- drive-mount-panel
```
EXPECT: codegen 가 새 mutation/query 4개 emit, tsc 0 error, vitest 통과.

### E2E (fakedsm)
```bash
STORAGE_AGENT_E2E=1 npm run test:e2e --workspace=services/api -- mount-credential
```
EXPECT: round-trip 통과 (Phase 2 fixture 재사용).

### 보안 — 평문 secret 누출 없음
```bash
# DB schema 변경 0건
git diff --stat services/api/src/database/schema/ services/api/drizzle/
# password 가 logger 인자에 직접 노출 0건
grep -rE "logger\.[a-z]+\([^)]*password" services/api/src/ services/storage-agent/
# secret-store 만 file write 권한 사용
grep -rE "fs\.writeFile|fs\.writeFileSync" services/api/src/ | grep -v "secret-store.ts\|secret-store.spec.ts\|test/"
```
EXPECT:
- schema diff 0줄
- logger password 노출 0건
- writeFile 사용처가 secret-store + 테스트 외 0건

### FSD 정합
```bash
# api 가 슬라이스 barrel 에서 export 안 됨
grep -E "^export.*from\s+['\"]\./api" services/web/src/features/mount-credential-*/index.ts services/web/src/entities/{drive,mount-credential}/index.ts
# model 이 codegen 함수 직접 import 안 함
grep -rE "from\s+['\"]@shared/api['\"]" services/web/src/features/mount-credential-*/model/
# catalyst import 0건
grep -rE "from\s+['\"]@/shared/ui/catalyst" services/web/src/features/mount-credential-* services/web/src/widgets/drive-mount-panel/
# same-layer cross-import 0건
grep -rE "from\s+['\"]@/features/(?!mount-credential-issue|mount-credential-revoke)" services/web/src/features/mount-credential-*/
```
EXPECT: 4 명령 모두 0건.

### Swagger 컨벤션
```bash
# Swagger plugin 자동 합성 영역(class-validator 메타)이 @ApiProperty 와 중복 안 됨
grep -E "@ApiProperty.*enum:\s*\[|@ApiProperty.*format:\s*'uuid'" services/api/src/mount-credential/dto/ services/api/src/drive/dto/
# @ApiError + ErrorCode 키 매핑
grep -E "@ApiError\(" services/api/src/mount-credential/mount-credential.controller.ts services/api/src/drive/drive.controller.ts
```
EXPECT:
- 중복 metadata 0건
- 각 controller 의 fail path 가 `@ApiError('KEY')` 로 명시

### 보안 — password/script 로깅 정책
```bash
grep -nE "logger\.[a-z]+\([^)]*\b(password|script|chapSecret|osPassword)\b" services/api/src/mount-credential/
```
EXPECT: 0건. business event 로그에는 `userId`/`driveId`/`credentialId` 만.

### EOL 규칙
```bash
file services/api/src/drive/**/*.ts services/api/src/mount-credential/**/*.ts   # CRLF
file services/web/src/features/mount-credential-*/**/*.tsx                       # CRLF
file services/api/src/mount-credential/script-template.ts                        # CRLF
```
EXPECT: 모든 `.ts`/`.tsx` 가 CRLF.

### Manual Validation (본인 환경)
- [ ] web UI 발급 → 다이얼로그에 password 평문 표시 (마스킹 토글 동작) + `.ps1` 다운로드 동작
- [ ] PowerShell ISE 또는 elevated PowerShell 에서 `.ps1` 실행 → 1분 안에 `Get-Disk` 에 새 디스크
- [ ] `diskmgmt.msc` 에서 GPT 초기화 후 `Z:` 마운트 (1회용 — 본 phase 외)
- [ ] web UI 회수 → 1분 안에 `Get-Disk` 에서 disk 사라짐
- [ ] 같은 driveId 로 즉시 재발급 시 `MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL` 응답
- [ ] 회수 후 재발급 시 정상 동작
- [ ] 발급 다이얼로그 닫은 뒤 GET API 가 password/script 필드 미포함 응답
- [ ] script 본문에 password 가 PowerShell escape 정확 (특수문자 password 로 시도 — base64url 한정이라 risk 낮지만 안전성 확인)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 0 spike 가 CHAP disabled 로 검증 — Phase 3 CHAP enabled path 는 신규 경로라 synowebapi 호출에서 미발견 결함 가능 | M | H | Task 9 manual smoke 가 가장 중요한 확인. fakedsm e2e 통과 ≠ 실 DSM 통과. 발급 1회는 반드시 본인 NAS 에서 실 검증 |
| `.ps1` 의 PowerShell escape — password 에 `"`, `` ` ``, `$` 가 들어가면 cmd 실패 | L | M | Task 5 의 password 생성을 `crypto.randomBytes(16).toString('base64url')` 로 — base64url charset = `[A-Za-z0-9_-]` 만 emit. escape risk 원천 차단. Task 4 가 안전망으로 special char escape 도 검증 |
| Docker Secret 디렉토리 권한 (`/run/secrets/`) 이 NestJS 컨테이너 user 와 불일치 → write 실패 | M | H | Task 3 의 secret-store 가 명확한 에러 `MOUNT_CREDENTIAL_SECRET_WRITE_FAILED` + 로그. operator 가 즉시 알아챔. dev 환경은 tmp fallback |
| issue 도중 agent.createTarget 성공 → DB insert 실패 → 양쪽 drift (target 은 존재, DB 는 row 없음) | L | H | service 의 issue 가 (a) secret write → (b) agent create → (c) DB insert 순서. (c) 실패 시 (b) rollback (`storageAgentClient.deleteTarget`) → (a) rollback (`secretStore.remove`). 실패 cleanup 흐름 unit 테스트 (Task 5 RED 3) |
| revoke 도중 agent.deleteTarget 실패 (NOT_FOUND 외) → DB 는 revoked 로 표시되었으나 target 잔존 | M | M | Task 5 의 revoke 가 (a) agent delete → (b) secret remove → (c) DB softRevoke 순서. agent NOT_FOUND 는 idempotent, 다른 실패는 throw + DB 미갱신. operator 가 재시도 |
| codegen 산출물과 수동 작성 type 의 drift — issue response 의 1회용 `password`/`script` 필드가 codegen 에서 누락 | M | H | DTO 클래스에 `@ApiProperty()` 명시 + Task 6 의 generated diff 검토에 두 필드 존재 확인 단계 추가 |
| mobile-ui-guide v1.0 의 modal headless 컴포넌트가 본 phase 시점에 미준비 — 새 modal 작성이 design-system-v1 Milestone 2 와 충돌 | M | M | Task 7 시작 전 `services/web/src/shared/ui/modal/` 존재 여부 확인. 미존재면 minimal 채택 + design-system-v1 PRD 의 다음 PR 에서 정식화. 본 phase 에서 임시 modal 1개 작성이 어쩔 수 없다면 catalyst 의존 0 + token utility 만 사용 |
| Phase 4 가 본 phase 의 surface 를 매일 사용 — UX 결함이 30일 동안 마찰 | M | M | manual smoke 후 발견된 작은 UX 결함은 별도 follow-up PR 로 즉시 머지 |
| share-grants 테이블이 본 phase 의 코드에 우연히 참조됨 → Phase 5 책임 침범 | L | M | Validation Commands 의 grep — `services/api/src/mount-credential/` 안에 `shareGrants` 또는 `share-grants` 0건 |
| 발급 후 다이얼로그를 닫지 않고 페이지 이탈 → React state 가 메모리에 남아 password 가 console 또는 DevTools 에 노출 | L | M | `useIssueMountCredential` 의 `clearIssued` 가 `useEffect` cleanup 에서 자동 호출. password 는 ref 가 아닌 state 로 — React unmount 시 GC |
| `STORAGE_AGENT_PORTAL_HOST` 환경변수가 dev/staging/prod 마다 다름 — issue 응답이 잘못된 host 로 가는 사고 | L | H | startup 시 `ConfigService.getOrThrow('STORAGE_AGENT_PORTAL_HOST')` 로 부재 시 즉시 fail. e2e 가 명시 env 로 검증 |
| issue 응답에 `script` 본문 포함 (D3 (B)) 가 OpenAPI doc 에서 large response example 로 noise | L | L | DTO 의 `@ApiProperty({ description: '1회용 PowerShell 스크립트. 다음 GET 응답에는 미포함.' })` 명시 |

---

## Acceptance Criteria

- [ ] `services/api/src/drive/` 모듈이 `GET /api/drives/me` 동작 + ownership 검증
- [ ] `services/api/src/mount-credential/` 모듈이 issue/list/revoke 3 endpoint 동작
- [ ] issue 응답 DTO 에 `password` 와 `script` 1회용 필드 포함, GET/list 응답에는 미포함
- [ ] secret-store 가 file-based 로 동작하며 dev 환경 fallback 동작
- [ ] script-template 이 base64url password 외에도 PowerShell special character escape 정확
- [ ] `services/api/test/mount-credential.e2e-spec.ts` fakedsm 라운드트립 통과
- [ ] `services/web/src/entities/drive/`, `entities/mount-credential/` 2 slice 생성 + barrel
- [ ] `services/web/src/features/mount-credential-issue/`, `mount-credential-revoke/` 2 slice — api 비공개 + model 이 codegen 직접 import 0건
- [ ] `services/web/src/widgets/drive-mount-panel/` 가 자체 비즈니스 로직 0 + features 조합만
- [ ] `pages/drive/` 가 widget 을 mount + 페이지 라우트에서 도달
- [ ] catalyst import 0건 — mobile-ui-guide §8.2 준수
- [ ] axe-core a11y 통과 + keyboard navigation 검증
- [ ] codegen 산출물에 4개 신규 mutation/query 함수 등재 + issue response 에 password/script 포함
- [ ] 본인 환경 manual smoke 통과 (8 항목 모두)
- [ ] PRD Phase 3 row `complete` + PRP 컬럼에 본 plan 경로
- [ ] 본 plan frontmatter `status` 가 `done`
- [ ] 본 PR diff 에 `services/api/src/file/**`, `services/api/src/folder/**`, schema 변경, share-grants 코드 변경 0줄

## Completion Checklist

- [ ] 평문 password / script 가 logger 인자, DB 컬럼, GET 응답 어디에도 노출 없음
- [ ] EOL 규칙: API/Web `.ts`/`.tsx` = CRLF (script-template 의 출력 line ending 은 CRLF Windows convention)
- [ ] issue 실패 cleanup: agent rollback + secret rollback 검증 unit 테스트
- [ ] revoke idempotent (agent NOT_FOUND 도 success) 검증
- [ ] FSD layer 위반 0건 (validation grep 4종 모두 통과)
- [ ] services/web mobile-ui-guide §6.2 token utility 만 사용 (hex/rgb 0건)
- [ ] codegen + 수동 작성 type drift 0건 (Task 6 의 diff 검토 + Task 5 의 DTO `@ApiProperty` 명시)
- [ ] `.ps1` 본문이 본인 PC 의 PowerShell 7.x 에서 실행 성공 (manual smoke)
- [ ] PR 본문에 manual smoke 결과 첨부

## Notes

- 본 plan 은 **`.worktrees/storage-phase3/` 에서 작성 + 작업**. 작성 자체도 worktree 정책 준수 (CLAUDE.md §"모든 작업은 worktree에서 진행")
- 본 plan 은 Phase 1·2 와 달리 **단독 PR** (parallel 없음). 머지 직후 Phase 4 의 30일 검증 phase 의 *입력*이 되므로 manual smoke 통과를 acceptance criteria 에 포함
- **D3 의 (B) 결정** (issue 응답에 script 본문 포함) 이 본 plan 의 가장 큰 wire-format 결정. controller endpoint 3개 (POST/GET/DELETE) 만 신설 — 별도 `.ps1` 다운로드 endpoint 없음
- **secret-store 구현은 v1.0 file-based** — 향후 v1.x 에서 Vault / 호스트 OS keyring 같은 backend 로 확장 시 별도 ADR (`0005-secret-storage-backend.md` 후보). 본 phase 의 `SecretStore` interface 가 그 확장 지점
- modal headless 컴포넌트 부재 risk — Task 7 시작 시 첫 작업으로 `ls services/web/src/shared/ui/` 검증
- Phase 0 spike 의 raw `synowebapi` 응답 (DSM 자동 생성 IQN `iqn.2000-01.com.synology:...`) 과 본 phase 의 명시 IQN (`iqn.2026-05.com.terab:{driveId}`) 은 다른 namespace — synowebapi 가 명시 IQN 을 그대로 받는지 Phase 2 의 `internal/dsm/synowebapi.go` 구현 확인 필요 (Task 2 시작 전 점검)
- password 를 `crypto.randomBytes(16).toString('base64url')` 로 생성 — PowerShell special character escape risk 원천 차단 (base64url charset = `[A-Za-z0-9_-]`)
- 본 plan 은 `/ecc:prp-implement` TDD validation loop 가 적용되는 가장 큰 phase

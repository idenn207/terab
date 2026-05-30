# `.claude/plans/` — ECC 산출물 가이드

이 디렉토리는 ECC(Everything Claude Code) 표준 흐름의 **plan 산출물**을 보관합니다. PRD는 `../prds/`, archive는 `docs/archive/superpowers/` 를 참조하세요.

## 표준 흐름

```
/ecc:plan-prd  →  /ecc:plan  →  /ecc:prp-implement
   (PRD)           (Plan)         (구현 + 검증)
```

| 단계 | 명령 | 산출물 위치 | 목적 |
|---|---|---|---|
| PRD | `/ecc:plan-prd` | `.claude/prds/{slug}.prd.md` | Problem/Hypothesis/Scope/Acceptance + Delivery Milestones |
| Plan | `/ecc:plan {prd-path}` | `.claude/plans/{slug}.plan.md` | Files/Tasks/Validation/Risks/Acceptance |
| Implement | `/ecc:prp-implement {plan-path}` | (코드 변경) | Task별 TDD + Validation loop |

## 파일 명명 규칙

- **PRD**: `{kebab-slug}.prd.md` (예: `superpowers-to-ecc-migration.prd.md`)
- **Plan**: `{kebab-slug}.plan.md` (예: `docs-ecc-realignment.plan.md`)
- slug 은 PRD ↔ Plan 매칭이 자명하도록 가능하면 일치시킬 것 (단, PRD 하나에 plan 여러 개 가능)
- 날짜 prefix는 **금지** — frontmatter `created` 필드를 사용 (`docs/archive/superpowers/` 의 레거시 명명과 구분)

## frontmatter 컨벤션

PRD/Plan 모두 다음 frontmatter 를 상단에 포함:

```yaml
---
name: kebab-slug-here
description: 한 줄 요약 (검색용)
status: pending | in-progress | done | archived
created: YYYY-MM-DD
---
```

| status | 의미 |
|---|---|
| `pending` | 작성됐으나 아직 시작 안 함 |
| `in-progress` | 현재 진행 중 (한 워크스트림 당 권장 1개) |
| `done` | 완료. 30일 후 archive 이전 대상 |
| `archived` | `docs/archive/superpowers/` 로 이전됨 (frontmatter 만 갱신, 본문 보존) |

## archive 정책

- 완료(`done`) 후 **30일 경과** 시 `docs/archive/superpowers/{plans,specs}/` 로 이전
- 이전 시 git history 보존을 위해 `git mv` 사용
- archive 내부 상대경로는 깨질 수 있음 — historical reference로만 사용 (수정 비용 > 가치)
- 색인은 `docs/archive/superpowers/INDEX.md` 에 주제별로 유지

## 도메인 용어

신규 PRD/Plan 작성 시 `CLAUDE.md` 의 도메인 용어 표를 그대로 사용. 핵심 식별자: `File`, `Folder`, `Drive`, `User`, `Permission`, `Role`, `Share`.

## 디자인 plan 작성 시

services/web 의 컴포넌트·페이지·widget·디자인 시스템 plan 은 [mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) 의 v1.1 정책을 *plan 본문에서 직접 인용* 해야 한다. 본 의무는 *design plan 만* 대상 — API/MQ/인프라 plan 은 무관.

| 인용 의무 anchor | 의미 | 인용 시점 |
|---|---|---|
| [§5.1.1 modular scale × 사용처 매핑](../rules/ecc/web/mobile-ui-guide.md) | 페이지 H1/H2/body 등 `--text-*` 단계가 §5.1.1 매핑과 일치하는지 | `Files to Change` / `Tasks` 에 각 페이지의 token 단계 명시 |
| [§5.2.1 60/30/10 시각 비율](../rules/ecc/web/mobile-ui-guide.md) | 강조색 ≤ 10% / 보조색 ≤ 30% / 지배색 ≥ 60% 면적 비율 | `Risks` 또는 `Tasks` 에 강조색 사용처 1~2개로 한정 명시 |
| [§5.5 페이지군 token 매핑](../rules/ecc/web/mobile-ui-guide.md) | route prefix (auth/drive/admin) 별 family 톤 default | `Files to Change` 의 route prefix 별로 family 톤 cross-check |
| [§9 Atomic 5단계 gate](../rules/ecc/web/mobile-ui-guide.md) | anatomy → token → a11y → motion → anti-template 순서 | `Tasks` 가 §9 5단계 순서로 작성되거나, 각 Task 가 어느 단계인지 명시 |

> §5.1.1·§5.2.1·§5.5·§9 중 *어느 하나도 인용 안 되면* PR 리뷰에서 호출. 4 anchor 모두 의무는 아님 — 본문에 해당 결정이 등장하지 않는 plan(예: 텍스트만 다루는 i18n plan)은 cross-link 없이 진행 가능.

실제 디자인 변경 PR 은 [`.github/PULL_REQUEST_TEMPLATE/web-component.md`](../../.github/PULL_REQUEST_TEMPLATE/web-component.md) 를 사용 — `gh pr create --template web-component.md` 또는 GitHub web 의 `?template=web-component.md` query 로 라우팅.

## 예시

이 가이드 자체의 모범 예시:
- 마스터 PRD: [`../prds/superpowers-to-ecc-migration.prd.md`](../prds/superpowers-to-ecc-migration.prd.md)
- 첫 Plan: [`docs-ecc-realignment.plan.md`](docs-ecc-realignment.plan.md)

## 진행 중 작업 추적

마스터 PRD 의 Delivery Milestones 표가 각 워크스트림 status 와 plan 경로의 single source of truth. 신규 plan 생성 시 마스터 PRD 의 해당 row 를 `pending` → `in-progress` 로, 완료 시 `done` 으로 갱신.

## superpowers 와의 차이

| 항목 | superpowers | ECC |
|---|---|---|
| 위치 | `docs/superpowers/{plans,specs,finish-plans,finish-specs}/` | `.claude/{prds,plans}/` |
| 완료 표기 | `finish-` prefix 폴더 분리 | `status: done` frontmatter |
| 명명 | `YYYY-MM-DD-{slug}.md` | `{slug}.{prd|plan}.md` + frontmatter `created` |
| 호출 | superpowers 슬래시 명령 | `/ecc:plan-prd`, `/ecc:plan`, `/ecc:prp-implement` |
| 도메인 | 단일 평면 | PRD(why/what) ↔ Plan(how) 분리 |

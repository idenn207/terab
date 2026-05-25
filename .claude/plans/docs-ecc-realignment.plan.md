# Plan: 기존 문서 ECC 구조 정합화

**Source PRD**: (free-form, 마스터 로드맵은 inline)
**Selected Milestone**: Workstream 2 — Docs ↔ ECC 구조 정합화
**Complexity**: Medium

## Summary

`docs/superpowers/` 4분면(plans/specs/finish-plans/finish-specs)에 누적된 30+개 문서와 `docs/planning/` 의 기획 문서를 ECC 표준 산출물 디렉토리(`.claude/prds/`, `.claude/plans/`)와 명명 규칙으로 정렬한다. 실시간 마이그레이션이 아닌 **레거시 archive + 신규 ECC 흐름 정착** 두 트랙으로 분리해 진행 작업과의 충돌을 피한다.

## Master Roadmap (5개 워크스트림 개요)

| # | 워크스트림 | 우선순위 | 복잡도 | 산출물 위치 |
|---|---|---|---|---|
| 1 | superpowers → ECC 워크플로우 위임 | High (이 plan과 묶음) | Small | `.claude/AGENTS.md` 또는 `CLAUDE.md` 갱신 |
| 2 | **기존 문서 ECC 구조 정합화** | **1순위 (현 plan)** | Medium | `.claude/prds/`, `.claude/plans/`, `docs/archive/` |
| 3 | 서비스 기획 최신화 (Spring→NestJS 격차 해소) | High (워크스트림 2 후속) | Medium | `docs/planning/*` 갱신 |
| 4 | 코드 패턴 정리/재구조화 | Medium | Large | `services/api/`, `services/web/` 리팩토링 |
| 5 | 아키텍처 정리 (docs + 다이어그램) | Medium (3 후속) | Medium | `docs/planning/architecture.md` + 신규 ADR |

> 각 워크스트림은 별도 `/ecc:plan-prd` → `/ecc:plan` 호출로 분리 진행을 권장합니다. 현 plan은 **워크스트림 1 + 2 묶음**(둘이 강결합이라 함께 처리)에 집중합니다.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 문서 명명 | `docs/superpowers/finish-plans/2026-05-14-api-core-and-logging-consistency.md` | `YYYY-MM-DD-{kebab-slug}.md` 유지 (날짜 prefix가 timeline 추적에 유리) |
| Plan 포맷 | `docs/superpowers/finish-plans/2026-05-14-*.md` | Goal/Architecture/Tech Stack/File Structure/Phase·Task·Step 체크박스 → ECC plan command spec과 호환 |
| Spec → PRD 변환 | `docs/superpowers/finish-specs/2026-05-14-*-design.md` | "배경/목표/범위/변경 후 구조" 4분할은 ECC PRD의 Problem/Hypothesis/Scope/Acceptance와 거의 1:1 |
| 아카이브 표기 | `docs/superpowers/finish-*/` 폴더 | 폴더 분리 → ECC는 frontmatter `status: archived` 권장 |
| 도메인 용어 | `CLAUDE.md` 도메인 용어 표 | File/Folder/Drive/User/Permission/Role/Share — 신규 PRD/Plan에서 동일 유지 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `.claude/plans/docs-ecc-realignment.plan.md` | CREATE | 이 plan (현재 작성 중) |
| `.claude/prds/superpowers-to-ecc-migration.prd.md` | CREATE | 5개 워크스트림 PRD화 — 후속 plan들이 reference로 사용 |
| `.claude/plans/README.md` | CREATE | ECC plan/PRD 디렉토리 사용 가이드 (한국어, 도메인 용어 포함) |
| `docs/archive/superpowers/` | RENAME (`docs/superpowers/finish-*` → 이동) | "완료" 표시를 폴더 → 디렉토리 명확화. 검색·grep은 그대로 작동 |
| `docs/archive/superpowers/INDEX.md` | CREATE | 60+개 archive 문서의 색인 (날짜/주제/관련 코드 영역) |
| `docs/superpowers/plans/`, `specs/` | KEEP for now, GRADUALLY MIGRATE | 진행 중 작업이 있을 수 있어 즉시 이동 금지 — 종료 시 `docs/archive/`로 이동 |
| `CLAUDE.md` | UPDATE | "개발 워크플로우: `/ecc:plan-prd → /ecc:plan → /ecc:prp-implement`" 섹션 추가, superpowers 언급 제거 |
| `.claude/settings.json` | KEEP | superpowers 이미 disabled, ECC enabled — 변경 없음 |

## Tasks

### Task 1: 마스터 PRD 작성 (`superpowers-to-ecc-migration.prd.md`)
- **Action**: 5개 워크스트림의 Problem/Hypothesis/Scope/Acceptance + Delivery Milestones 표 작성. 각 milestone 행에 Plan 컬럼 비워두기 (후속 `/ecc:plan` 호출이 채움)
- **Mirror**: `docs/superpowers/finish-specs/2026-05-14-api-core-and-logging-consistency-design.md` 의 §0 배경, §1 작업 범위, §2 분해 구조
- **Validate**: PRD 파일이 ECC plan command spec의 PRD 인식 포맷(상단 `# PRD:` + Delivery Milestones 표)을 충족하는지 육안 검토

### Task 2: 도메인 용어 일관성 표 ECC PRD에 복제
- **Action**: `CLAUDE.md` 의 한글-영문 도메인 용어 표를 `superpowers-to-ecc-migration.prd.md` 의 Glossary 섹션으로 복사 (영문 식별자가 ECC 산출물 전반에서 일관되도록)
- **Mirror**: `CLAUDE.md` 도메인 용어 섹션 그대로
- **Validate**: PRD의 Glossary와 CLAUDE.md 표가 7행 모두 일치

### Task 3: archive 디렉토리 신설 + finish-* 이동
- **Action**: `docs/archive/superpowers/{plans,specs}/` 생성 후 `docs/superpowers/finish-plans/*` → `docs/archive/superpowers/plans/`, `finish-specs/*` → `docs/archive/superpowers/specs/` 이동. `git mv` 사용해 history 보존
- **Mirror**: 없음 (신규 디렉토리 컨벤션)
- **Validate**:
  - `docs/superpowers/finish-*` 디렉토리가 비어있고 삭제됨
  - `docs/archive/superpowers/` 하위에 60+ 파일 (plans + specs 합산)
  - `git log --follow` 로 임의 파일 history 추적 가능

### Task 4: archive INDEX.md 생성
- **Action**: 60+ archive 파일을 다음 카테고리로 색인 — 인증/2FA, 인프라/배포, 환경설정, API 베이스 시스템, ts-rest 마이그레이션, 파일 관리, 로깅/관측성, MQ/알림, 모바일. 각 항목에 (날짜 / 제목 / 관련 코드 경로 1줄)
- **Mirror**: 없음 — 신규 색인 컨벤션
- **Validate**: 모든 archive 파일이 INDEX에 1회 이상 등장 (grep으로 누락 검출)

### Task 5: `.claude/plans/README.md` 가이드 작성
- **Action**: 한국어로 (1) 표준 흐름 `/ecc:plan-prd → /ecc:plan → /ecc:prp-implement` (2) PRD/plan 파일 명명 규칙 (`{kebab-slug}.prd.md`, `{kebab-slug}.plan.md`) (3) status 관리(frontmatter: `pending|in-progress|done|archived`) (4) archive 정책 (완료 30일 후 `docs/archive/` 이동) 작성
- **Mirror**: ECC `/ecc:plan` command spec의 PRD Artifact Output 섹션
- **Validate**: 신규 사용자가 README만 읽고 `/ecc:plan-prd` → `/ecc:plan` 흐름을 따라할 수 있는지 셀프 리뷰

### Task 6: CLAUDE.md 워크플로우 섹션 갱신
- **Action**: "## Claude 행동 지침" 다음에 "## 개발 워크플로우 (ECC)" 섹션 추가. 표준 흐름·산출물 위치·archive 정책을 5줄 이내로 요약. superpowers 단어 등장 시 제거 또는 "(historical reference: `docs/archive/superpowers/`)" 로 대체
- **Mirror**: `CLAUDE.md` 의 기존 섹션 헤더 톤(한글, 명사형 종결)
- **Validate**:
  - `grep superpowers CLAUDE.md` 결과 0건 또는 archive 참조뿐
  - 새 섹션이 CRLF로 저장됐는지 PowerShell `(Get-Content -Raw CLAUDE.md) -match "\r\n"` 확인 (project CLAUDE.md 요구사항)

### Task 7: 마스터 PRD Delivery Milestones에 워크스트림 3·4·5 milestone 등록
- **Action**: 워크스트림 3(서비스 기획 최신화), 4(코드 패턴 정리), 5(아키텍처 정리)를 각각 별도 milestone 행으로 등록. 우선순위·예상 plan 경로(`.claude/plans/service-planning-refresh.plan.md` 등)·status `pending` 으로
- **Mirror**: ECC plan command spec의 Delivery Milestones 표
- **Validate**: 마스터 PRD에서 워크스트림 3·4·5가 `pending`, 2가 `in-progress`, 1이 이 plan과 함께 묶여 `in-progress`로 표시

## Validation

```bash
# 디렉토리 정합성
test -f .claude/prds/superpowers-to-ecc-migration.prd.md
test -f .claude/plans/docs-ecc-realignment.plan.md
test -f .claude/plans/README.md
test -d docs/archive/superpowers/plans
test -d docs/archive/superpowers/specs
test ! -d docs/superpowers/finish-plans
test ! -d docs/superpowers/finish-specs

# CLAUDE.md 정리
grep -c "ecc:plan-prd" CLAUDE.md   # >= 1
grep -ci "superpowers" CLAUDE.md   # 0 또는 archive 참조만

# git history 보존 (임의 파일)
git log --follow docs/archive/superpowers/specs/2026-05-14-api-core-and-logging-consistency-design.md | head -3

# INDEX 완전성
ls docs/archive/superpowers/{plans,specs}/*.md | wc -l   # >= 60
grep -c "^- " docs/archive/superpowers/INDEX.md          # 위 수치 이상
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `docs/superpowers/plans/` 와 `specs/` 에 진행 중 작업이 있어 archive로 잘못 옮김 | Medium | `finish-*` 만 이동, `plans/`·`specs/` 는 작업 종료 후 분기 이동 |
| `git mv` 후 history 추적 깨짐 (Windows 권한/EOL) | Low | 한 파일만 먼저 이동해서 `git log --follow` 검증 후 일괄 진행 |
| CLAUDE.md 갱신이 진행 중인 다른 PR과 충돌 | Medium | 마스터 PRD/plan 머지 후 즉시 별도 PR로 분리 |
| archive INDEX가 outdated 되어 의미 상실 | High (시간 경과) | INDEX 상단에 "Last updated: YYYY-MM-DD" + 6개월 주기 갱신 정책 명시. archive 자체는 timestamp가 명시되어 있어 INDEX 누락도 치명적이지 않음 |
| ECC `.claude/plans/{name}.plan.md` 가 PRD 마일스톤 자동 마킹을 시도해 마스터 PRD를 의도와 다르게 수정 | Medium | 이 plan은 free-form mode로 작성해 자동 마킹 회피. 후속 `/ecc:plan {prd}` 호출 시에만 자동 마킹 동작 |
| Linux 컨테이너에서 실행되는 파일(예: scripts/*.sh)에 archive 경로가 하드코딩돼 있을 가능성 | Low | 이동 전 `grep -r "docs/superpowers/finish-" scripts/ services/` 로 참조 검출. 발견 시 path 갱신 포함 |

## Acceptance

- [ ] 모든 Task 완료
- [ ] Validation 명령 전부 통과
- [ ] `docs/superpowers/finish-*` 디렉토리 0개, `docs/archive/superpowers/{plans,specs}/` 60+ 파일
- [ ] `.claude/prds/superpowers-to-ecc-migration.prd.md` 가 5개 워크스트림 milestone 전체 포함
- [ ] CLAUDE.md 가 ECC 표준 흐름을 명시하고 superpowers 미언급
- [ ] 후속 워크스트림 3·4·5는 각각 `/ecc:plan` 으로 독립 plan 작성 가능한 상태
- [ ] 모든 신규 생성 파일이 CRLF (Windows 개발 환경 기본)

## Out of Scope (이 plan 범위 밖)

- 워크스트림 3: 서비스 기획 최신화 (Spring → NestJS 격차 해소) — `docs/planning/architecture.md`·`release-plan.md`·`milestones.md` 본문 갱신
- 워크스트림 4: 코드 패턴 정리/재구조화 — services/api·web 리팩토링
- 워크스트림 5: 아키텍처 정리 — Mermaid 다이어그램 재작성, ADR 신규 작성
- superpowers plugin 자체의 disable/uninstall (이미 settings.json에서 disabled, 추가 작업 불필요)
- `docs/superpowers/plans/`, `specs/` (진행 중 가능성 있는 작업) 이동 — 작업 종료 후 별도 plan

## Suggested Follow-up Order

1. 이 plan 승인 → 즉시 실행 (워크스트림 1+2)
2. `/ecc:plan-prd .claude/prds/superpowers-to-ecc-migration.prd.md` 로 마스터 PRD 정식화 (선택)
3. `/ecc:plan .claude/prds/superpowers-to-ecc-migration.prd.md` 로 워크스트림 3 (서비스 기획 최신화) plan 생성
4. 워크스트림 3 머지 후 워크스트림 5 (아키텍처 정리) plan — 다이어그램은 최신 기획에 의존
5. 워크스트림 4 (코드 패턴 정리)는 가장 큰 작업이라 별도 sprint 권장 — `/ecc:plan-prd` 부터 다시 시작

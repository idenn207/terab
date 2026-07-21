---
slug: design-system-v1-1-m3-dogfood-verification
status: draft
milestone: 3
prd: .claude/prds/design-system-v1-1-foundations.prd.md
worktree: .worktrees/archive-v1-1-enforcement-plan
branch: chore/archive-v1-1-enforcement-plan
base: v0.1
---

# Plan — design-system v1.1 milestone 3: 신규 design PR 3건 dogfood 검증

## 요약

M2 Phase 1 머지(d65ab43 mobile-ui-guide v1.1 + #73 plan checklist + web-component PR template)로 [PRD §Scope 강제 메커니즘](../prds/design-system-v1-1-foundations.prd.md) 4단 중 **Stage 1 만 활성된 상태**에서, [PRD §Hypothesis](../prds/design-system-v1-1-foundations.prd.md) 의 *"본인 + 미래 Claude 가 design 결함 4종을 plan 단계부터 인지·차단"* 가설을 신규 design PR 3건 sample 로 측정한다.

본 plan 은 *측정 plan + PRD 동기화* — *코드 변경 산출물은 PRD 파일 한 곳*. 측정 실행 자체는 본 plan 머지 후 도착하는 design PR 3건이 trigger 이며, 측정 method 와 reporting 위치만 박제한다.

본 plan 은 한 commit 으로 (a) 기존 enforcement plan 의 archive 동기화 (abc98ba 가 `completed/` 로 이동) (b) PRD Delivery Milestones 표의 M2 status 를 `done (phase 1 only — 4단 중 stage 1)` 으로 closure + Phase 2~4 가 별도 PRD 로 분기됨을 명시 (c) M3 row 를 `blocked (design PR 3건 도착 대기)` 로 mark + 본 plan 으로 link — 3개 동기화를 묶는다.

**복잡도**: Small — PRD 동기화 + 측정 method 박제. *측정 결과 도출 자체는 design PR 3건 도착까지 indefinite — 본 plan acceptance 범위 외부*.

## PRD ↔ plan 매핑

| PRD 항목 | 본 plan 의 처리 | Task |
|---|---|---|
| §Hypothesis — 4단 종합 효과 가정 | Stage 1 단독 효과 측정으로 **부분 검증** 명시 | Task 3 |
| §Success Metrics — 5개 지표 | 각 지표 × measurement source 매핑 표 박제 | Task 3 |
| Delivery Milestones M2 — `in-progress` + archive 된 plan link | `done (phase 1 only)` + completed/ 경로 동기화 | Task 1 |
| Delivery Milestones M3 — `pending` | `blocked (design PR 3건 도착 대기)` + 본 plan link | Task 1 |
| §Scope 강제 메커니즘 표 — Stage 2~4 분리 | "별도 PRD 분기" 로 표시 + 후속 PRD slug 결정 | Task 2, Task 6 |

> 본 plan 은 [enforcement plan](completed/design-system-v1-1-enforcement.plan.md) 의 *Phase 2~4 후속 분기* 와 형제 관계 — 측정 결과가 후속 PRD 도출 여부를 결정.

## Patterns to Mirror

| Category | Source (file:line) | Pattern |
|---|---|---|
| Plan 문서 형식 | [.claude/plans/completed/design-system-v1-1-enforcement.plan.md:1-12](completed/design-system-v1-1-enforcement.plan.md) | YAML frontmatter (slug/status/milestone/prd/worktree/branch/base) + 한글 단문 + 표 위주 + ✶ 없음 |
| PRD 동기화 한 commit | commit abc98ba (archive enforcement plan) | 동기화는 *한 commit 으로* + commit message 에 sync 의도 명시 |
| Reporting location | `.claude/reports/` (main) vs `.worktrees/{slug}/.claude/reports/` 둘 다 선례 | main `.claude/reports/` — worktree 단위는 archive 시 손실 위험 (Task 5 결정) |
| 측정 plan 형식 (선례 부재) | — | 본 plan 이 *최초 측정 plan* — 후속 측정 plan 의 reference 가 됨 |

> 측정 method 표 자체는 *본 plan 이 최초 박제* — patterns to mirror 가 없다. 후속 측정 plan 은 본 plan 의 Task 3 표를 mirror.

## Open Question 결정 (PRD §Open Questions 외 신규)

| OQ | 본 plan 의 결정 | Task |
|---|---|---|
| **OQ-N1** Stage 2~4 후속 PRD 형식 — 신규 PRD 분리 vs 본 PRD 에 M4/M5/M6 row 추가 | **신규 PRD 분리** — `design-system-v1-1-enforcement-stage2-4.prd.md`. 본 PRD §Hypothesis 가 Stage 1 만 활성된 시점의 측정으로 부분 검증되므로, Stage 2~4 는 *각 Stage 의 false-positive 측정 + 도구 호환성 PoC* 라는 별도 hypothesis — separate PRD 가 적합 | Task 6 |
| **OQ-N2** 측정 대상 PR sample 의 *design 관련 PR* 정의 | **PR diff 가 `services/web/src/{pages,widgets,shared/ui}/` 의 *시각 변경* 을 포함** — text-only / state logic-only / test-only PR 제외. 정의는 측정 시점에 `git diff --stat` + Task 4 의 marker 로 판정 | Task 4 |
| **OQ-N3** Reporting location | **`.claude/reports/design-system-v1-1-m3-dogfood-report.md`** — main 디렉토리. worktree 단위 `.claude/reports/` 는 worktree archive 시 손실 위험 | Task 5 |
| **OQ-N4** 측정 indefinite 의 Acceptance 범위 | **본 plan 의 acceptance = 측정 method 박제 + PRD 동기화 + sample 기준 박제**. 측정 실행 자체는 별도 *측정 commit* 으로 reporting | Acceptance |

## Files to Change

| 파일 | 변경 종류 | 비고 |
|---|---|---|
| [.claude/prds/design-system-v1-1-foundations.prd.md](../prds/design-system-v1-1-foundations.prd.md) | UPDATE | Delivery Milestones 표 (M2/M3 row) + §Scope 강제 메커니즘 표 (Stage 분리 footnote) |
| [.claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md](./design-system-v1-1-m3-dogfood-verification.plan.md) | CREATE | 본 파일 |
| (측정 시점 — 본 plan acceptance 외) [.claude/reports/design-system-v1-1-m3-dogfood-report.md](../reports/design-system-v1-1-m3-dogfood-report.md) | CREATE (future) | 본 plan §Tasks Task 5 의 reporting template 적용 |

> 본 plan 머지 commit 자체는 *코드 변경 0건* — markdown 만 변경. 측정 실행 commit 은 후속 별도 commit.

## Tasks

### Task 1 — PRD Delivery Milestones 표 동기화
- **Action**: PRD line 81~86 의 표 갱신
  - **M2 row**: `in-progress` → `done (phase 1 only — 4단 중 stage 1)`. Plan link → [completed/design-system-v1-1-enforcement.plan.md](completed/design-system-v1-1-enforcement.plan.md). Outcome 컬럼 끝에 *"Stage 2~4 는 후속 PRD `design-system-v1-1-enforcement-stage2-4` 로 분기"* 추가
  - **M3 row**: `pending` → `blocked (design PR 3건 도착 대기)`. Plan link → [design-system-v1-1-m3-dogfood-verification.plan.md](./design-system-v1-1-m3-dogfood-verification.plan.md)
- **Mirror**: 기존 M1 row 의 `done (commit d65ab43, PR #67, 2026-05-29)` 형식 — *commit + PR + 날짜 박제*. 본 commit 의 SHA 는 머지 시점에 알 수 없으므로 `done (phase 1 only — commit 889bc95 시점 acceptance 충족, sync commit TBD)` 형태로 commit hash 는 partial
- **Validate**:
  ```bash
  grep -E '^\| 2 \|.*\| done \(phase 1 only' .claude/prds/design-system-v1-1-foundations.prd.md
  grep -E '^\| 3 \|.*\| blocked' .claude/prds/design-system-v1-1-foundations.prd.md
  grep -E 'completed/design-system-v1-1-enforcement' .claude/prds/design-system-v1-1-foundations.prd.md
  ```

### Task 2 — PRD §Scope 강제 메커니즘 표에 Stage 분리 명시
- **Action**: PRD line 60~66 의 강제 메커니즘 표 *바로 아래에 footnote 한 줄* 추가
  - 형식: `> Stage 1 = M2 phase 1 (#73 머지). Stage 2/3/4 = deferred — 후속 PRD design-system-v1-1-enforcement-stage2-4 로 분기 (M3 dogfood 측정 결과에 따라 도입 여부 결정)`
- **Mirror**: PRD line 68 의 기존 footnote 형식 — `> 4단 동시 도입의 false-positive 리스크는...`
- **Validate**: `grep -E 'enforcement-stage2-4' .claude/prds/design-system-v1-1-foundations.prd.md` hit

### Task 3 — 측정 method 5개 지표 × source 매핑 박제

| Metric (PRD §Success Metrics) | Stage 1 활성 상태에서 측정 가능? | Measurement source | 측정 절차 |
|---|---|---|---|
| Plan 단계 디자인 결정 명시도 — v1.1 §색상/§타이포/§atomic gate 인용 | ✅ | post-#73 design plan 3건의 `.claude/plans/{slug}.plan.md` | `grep -cE '§(5\.1\.1\|5\.2\.1\|5\.5\|9)' .claude/plans/{sample}.plan.md` 가 ≥ 1 hit 인 plan 수 / 전체 design plan 수 |
| PR self-check checklist 통과 | ✅ | post-#73 design PR 3건의 PR body | [.github/PULL_REQUEST_TEMPLATE/web-component.md](../../.github/PULL_REQUEST_TEMPLATE/web-component.md) 의 7건 self-check 항목이 `- [x]` 인 카운트 / 7 |
| code-review 의 design 일관성 지적 | ⚠️ Stage 3 미활성 — *수동 code-review* 만 가능 | post-#73 design PR 3건의 PR conversation + Claude review output | "v1.1 §5 / §9 어긋남" 패턴 한글/영문 메모 hit 카운트. *주의: Stage 3 의 자동 cross-check 부재로 수동 review 누락 가능성 동시 박제* |
| Dogfood 단계 design 결함 재현 (E1~E5 한정) | ✅ | post-#73 design PR 의 dogfood 메모리(`project_design_system_*_dogfood`) 또는 follow-up PR | 본 plan §Risks "E1~E5 grep-able marker" 표 적용 |
| Vitest 페이지군 token 회귀 detection | ❌ Stage 4 미활성 — 측정 불가 | — | Stage 4 활성 후 별도 plan 으로 측정 |

- **Mirror**: 없음 (본 plan 이 최초 측정 표)
- **Validate**: 본 plan 본문에 위 5 row 가 그대로 존재 + ❌/⚠️ marker 가 Stage 2/3/4 미활성을 명시

### Task 4 — 측정 대상 PR sample 선정 기준 박제

| 기준 | 적용 |
|---|---|
| 시점 | commit abc98ba 이후 (`git log abc98ba..HEAD --oneline`) |
| 카운트 | 3건 |
| 정의 | `git diff abc98ba..HEAD --stat` 가 `services/web/src/{pages,widgets,shared/ui}/` 의 *시각 변경* 을 포함. text-only / state logic-only / test-only PR 제외 |
| 우선순위 | [mobile-ui-guide §5.5](../rules/ecc/web/mobile-ui-guide.md) family 별 *각각 ≥ 1건* 권장 (auth/drive/admin) — 부족할 경우 도착 순서대로 |
| 제외 대상 | 본 plan 머지 PR 자체 + enforcement plan archive PR + storage-phase3 같은 *백엔드 위주* PR |

- **Mirror**: 없음
- **Validate**: 본 plan 본문에 sample 정의 표 존재

### Task 5 — Reporting location 결정 + template skeleton 박제
- **Action**: 본 plan 본문에 reporting path + template skeleton 박제
  - **Path**: `.claude/reports/design-system-v1-1-m3-dogfood-report.md` (main `.claude/reports/`)
  - **Template skeleton** (측정 commit 시점에 fill-in):
    ```markdown
    # Report — design-system v1.1 M3 dogfood verification

    ## Sample
    | # | PR | Family | merge 시점 |
    |---|---|---|---|
    | 1 | #__ | auth/drive/admin | YYYY-MM-DD |

    ## Stage 1 단독 효과 측정 (PRD §Success Metrics)
    [Task 3 표 5 row × sample 3건 → 측정값 fill-in]

    ## E1~E5 패턴 재현 카운트
    [본 plan §Risks "E1~E5 grep-able marker" 적용 결과]

    ## 한계
    - Stage 2 (pre-CI lint) 미활성 → 측정 불가 항목
    - Stage 3 (code-reviewer agent) 미활성 → 수동 review 누락 가능성
    - Stage 4 (Vitest snapshot) 미활성 → 회귀 detection 불가

    ## 결론
    - hypothesis 부분 검증 결과: [Stage 1 단독 효과 평가]
    - 후속 PRD `design-system-v1-1-enforcement-stage2-4` 도입 권고/유보: [근거]
    - v1.2 보정 PRD 필요 여부: [E1~E5 재현 카운트 기반]
    ```
- **Mirror**: 본 PRD §Success Metrics + Stage 분기 의도와 매핑
- **Validate**: 본 plan 본문에 path + skeleton 단락 존재

### Task 6 — Stage 2~4 후속 PRD 분기 형식 결정 박제
- **Action**: 본 plan 본문에 후속 PRD 형식 박제
  - **slug**: `design-system-v1-1-enforcement-stage2-4`
  - **hypothesis 한 줄**: *"Stage 2 (pre-CI lint script) → Stage 3 (code-reviewer agent + ESLint token allowlist) → Stage 4 (Vitest 페이지군 snapshot) 가 *false-positive ≤ N건/PR* 조건에서 순차 통합되면, Stage 1 부분 검증을 4단 완전 검증으로 확장한다"*
  - **acceptance 한 줄**: *"각 Stage 별 false-positive 측정값 + 도구 호환성 PoC 결과 + 단계적 활성화 게이트 통과 시점 박제"*
  - **반영 위치**: PRD update 가 아닌 *본 plan 본문* (PRD §Out of scope 와 §후속 작업 참조 가능 형태)
- **Mirror**: 본 PRD §Hypothesis / §Acceptance / §Open Questions 형식
- **Validate**: 본 plan 본문에 후속 PRD slug + hypothesis + acceptance 가 한 단락에 박제

### Task 7 — 측정 실행 (indefinite — 본 plan acceptance 범위 외)
- **Action**: 본 plan 머지 후 design PR 3건이 도착하면 별도 *측정 commit* 으로 `.claude/reports/design-system-v1-1-m3-dogfood-report.md` 작성 — Task 5 의 template skeleton 적용
- **Mirror**: Task 5 의 reporting template
- **Validate**: 측정 commit 시점에 별도 — *본 plan acceptance 범위 외*

## Validation

```bash
# Task 1 — PRD M2/M3 동기화
grep -E '^\| 2 \|.*\| done \(phase 1 only' .claude/prds/design-system-v1-1-foundations.prd.md
grep -E '^\| 3 \|.*\| blocked' .claude/prds/design-system-v1-1-foundations.prd.md
grep -E 'completed/design-system-v1-1-enforcement' .claude/prds/design-system-v1-1-foundations.prd.md

# Task 2 — Stage 2~4 분기 footnote
grep -E 'enforcement-stage2-4' .claude/prds/design-system-v1-1-foundations.prd.md

# Task 3~6 — 본 plan 본문 자체에 표/skeleton 박제 확인
grep -c 'Measurement source' .claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md  # expect ≥ 1
grep -c 'Template skeleton' .claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md  # expect ≥ 1
grep -c 'enforcement-stage2-4' .claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md  # expect ≥ 3 (Task 2/6/후속)
grep -c 'grep-able marker' .claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md  # expect ≥ 2
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| design PR 3건이 *언제 도착할지* indefinite — 본 plan 이 long-running open 상태 | high | low | Acceptance 를 *측정 method 박제 + PRD 동기화* 까지로 한정. Task 7 측정 실행은 별도 commit. PRD M3 status 는 design PR 3건 누적 후 `done` 으로 갱신 |
| E1~E5 패턴의 PRD §Evidence 정의가 narrative 라 측정 기준 모호 | medium | high | 본 plan §Risks 아래 *E1~E5 grep-able marker* 표 박제 — 후속 reporting commit 이 본 표를 mirror |
| Stage 1 단독 효과 측정을 *4단 종합 hypothesis 검증* 으로 보고하면 misleading | high | medium | 본 plan §Tasks Task 3 표의 ⚠️/❌ marker + Task 5 reporting template 의 "한계" 섹션 박제 |
| 측정 대상 design PR sample 이 *family 편향* (예: drive 만 3건) | medium | low | Task 4 의 sample 정의에 *family 별 ≥ 1건 권장* 명시. 부족할 경우 도착 순서대로 — reporting 에 편향 명시 |
| 본 plan merge 가 *enforcement plan 의 archive commit (abc98ba)* 와 한 PR 로 묶이면 review 범위 ↑ | low | low | 본 PR description 에 *"plan archive + PRD sync + 후속 plan 도입 = 한 작업 단위"* 명시 + commit 분리 (archive abc98ba 이미 분리됨, sync 는 신규 commit) |
| PRD Delivery Milestones 표 갱신이 *다른 worktree* 의 동일 표 갱신과 충돌 | low | medium | 본 PR 머지 직전 `git fetch origin v0.1 && git diff origin/v0.1.. .claude/prds/design-system-v1-1-foundations.prd.md` 로 다른 worktree open PR 의 PRD 변경 cross-check. 현재 `.worktrees/design-system-v1/` 가 PRD 변경 포함 시 충돌 가능 |

### E1~E5 grep-able marker 정의 (Risk 2 mitigation)

| E# | PRD §Evidence narrative | grep-able marker (PR diff 또는 dogfood 메모리에서 검출) |
|---|---|---|
| E1 | 다크모드: 페이지별 contrast 어긋남 (검정 배경 + 검정 text) | dogfood 메모리에 `다크모드 contrast` / `1.4.3` / `다크모드 검정` 키워드 + 해당 PR 의 follow-up commit 존재 |
| E2 | catalyst 시각 어휘 답습 (import 없는 layout/widget) | 신규 컴포넌트의 `bg-zinc-` / `text-zinc-` 클래스 사용 + token utility (`bg-surface`, `text-text`, `bg-accent`) 미사용 |
| E3 | accent color 미사용 (primary 일관성 깨짐) | 신규 페이지의 1차 행동 button 에 `bg-accent` 가 없고 `bg-blue-` / `bg-zinc-` / `bg-indigo-` 사용 |
| E4 | family Layout 통일 부재 (Login / 2FA) | 같은 route prefix 의 page 들이 *공통 layout component* (예: `AuthLayout`) 미공유 — `src/pages/{family}/ui/*.tsx` 가 각자 `<div className="...">` 으로 시작 |
| E5 | 컴포넌트 재사용 없이 직접 작성 | 신규 페이지에 [shared/ui/{button,input,modal,toast,tooltip,select,checkbox,radio}/](../../services/web/src/shared/ui/) import 0건 + 동일 패턴 직접 구현 (`<button type="button" className="...">` raw markup) |

> 측정 commit 시점에 위 marker 를 *grep + 수동 검토 hybrid* 로 적용 — fully automated 측정 아님.

## 후속 작업

- **Stage 2~4 후속 PRD**: `.claude/prds/design-system-v1-1-enforcement-stage2-4.prd.md` — 본 plan 머지 후 도입 (별도 `/ecc:plan-prd` invocation). hypothesis/acceptance 는 본 plan Task 6 박제.
- **측정 reporting**: design PR 3건 도착 후 `.claude/reports/design-system-v1-1-m3-dogfood-report.md` 작성. 본 plan Task 5 의 reporting template skeleton 적용.
- **PRD 보정 PRD (조건부)**: 측정 결과 E1~E5 패턴 재현이 ≥ 1건 이면, [mobile-ui-guide v1.1](../rules/ecc/web/mobile-ui-guide.md) 의 *어느 anchor 가 검출 실패했는지* 분석 → v1.2 보정 PRD 도출.

## Acceptance

- [ ] Task 1 — PRD Delivery Milestones 표의 M2 row 가 `done (phase 1 only — 4단 중 stage 1)` + completed/ 경로 동기화, M3 row 가 `blocked (design PR 3건 도착 대기)` + 본 plan link
- [ ] Task 2 — PRD §Scope 강제 메커니즘 표 *footnote* 에 Stage 2~4 가 `deferred — enforcement-stage2-4` 분기로 명시
- [ ] Task 3 — 측정 method 5개 지표 × source 매핑 표가 본 plan 본문에 박제 + Stage 2/3/4 미활성으로 인한 ⚠️/❌ marker 명시
- [ ] Task 4 — sample 선정 기준 (시점/카운트/정의/우선순위/제외 대상) 표가 본 plan 본문에 박제
- [ ] Task 5 — reporting location (`/claude/reports/`) + template skeleton 이 본 plan 본문에 박제
- [ ] Task 6 — Stage 2~4 후속 PRD 의 *slug, hypothesis 한 줄, acceptance 한 줄* 이 본 plan 본문에 박제
- [ ] §Risks 의 *E1~E5 grep-able marker* 표가 본 plan 본문에 박제
- [ ] 본 plan 머지 commit message 에 *"plan archive + PRD sync + 후속 plan 도입 한 작업 단위"* 박제
- [ ] Task 7 측정 실행은 본 plan acceptance 범위 *외부* — 별도 commit 으로 분기됨을 §후속 작업 에 명시

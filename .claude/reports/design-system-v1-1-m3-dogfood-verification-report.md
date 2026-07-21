# 구현 보고서: design-system v1.1 milestone 3 — 신규 design PR 3건 dogfood 검증 (측정 method 박제)

- **Plan**: [`.claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md`](../plans/design-system-v1-1-m3-dogfood-verification.plan.md) → 본 PR 머지 후에도 `.claude/plans/` 에 *open 상태* 유지 (Task 7 측정 실행이 design PR 3건 도착까지 indefinite)
- **Worktree**: `.worktrees/archive-v1-1-enforcement-plan/`
- **Branch**: `chore/archive-v1-1-enforcement-plan` (base: `v0.1`)
- **PRD**: [`.claude/prds/design-system-v1-1-foundations.prd.md`](../prds/design-system-v1-1-foundations.prd.md) (Milestone 2 closure + Milestone 3 open)
- **본 PR 범위**: M3 acceptance 의 *measurement method 박제 + PRD 동기화* — 측정 실행 자체(Task 7)는 본 plan acceptance 범위 외부. PRD §Hypothesis 의 4단 종합 가설을 **Stage 1 단독 효과** 부분 검증으로 재정의

## 요약

M2 Phase 1 머지(d65ab43 mobile-ui-guide v1.1 + #73 plan checklist + web-component PR template)로 [PRD §Scope 강제 메커니즘](../prds/design-system-v1-1-foundations.prd.md) 4단 중 **Stage 1 만 활성된 상태** 에서, [PRD §Hypothesis](../prds/design-system-v1-1-foundations.prd.md) 의 *"본인 + 미래 Claude 가 design 결함 4종을 plan 단계부터 인지·차단"* 가설을 신규 design PR 3건 sample 로 측정하는 *method 박제* 를 본 plan 본문에 완료했다. 본 PR 은 한 commit 으로 (a) abc98ba 가 archive 한 enforcement plan 의 PRD link 동기화, (b) PRD Delivery Milestones 표의 M2 status closure (`done (phase 1 only — 4단 중 stage 1)`) + Stage 2~4 별도 PRD 분기 명시, (c) M3 row 의 `blocked (design PR 3건 도착 대기)` mark + 본 plan link, (d) 측정 method 5개 지표 × source 매핑 + sample 기준 + reporting template skeleton + 후속 PRD slug/hypothesis/acceptance — 4종 sync 를 묶는다.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small | Small — markdown 2개 파일 (PRD 5줄 + 신규 plan 1개) |
| Files Changed | PRD 1 update + plan 1 create (= 2) | 2 (정확히 일치) |
| 코드 변경 | 0 | 0 |
| Acceptance 범위 | 측정 method 박제 + PRD 동기화 + sample 기준 박제 까지 | Tasks 1~6 충족. Task 7 (측정 실행) 은 design PR 3건 도착 trigger 로 deferred |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | PRD Delivery Milestones 표 동기화 — M2 closure + M3 open | ✅ Complete | line 85 (M2): `done (phase 1 only — 4단 중 stage 1, commit 889bc95 시점 acceptance 충족, sync commit TBD)` + `completed/` 경로 link + Outcome 끝에 *"Stage 2~4 는 후속 PRD `design-system-v1-1-enforcement-stage2-4` 로 분기"* 박제. line 86 (M3): `blocked (design PR 3건 도착 대기)` + 본 plan link |
| 2 | PRD §Scope 강제 메커니즘 표에 Stage 분리 footnote 추가 | ✅ Complete | line 69 신설: *"Stage 1 = M2 phase 1 (#73 머지). Stage 2/3/4 = deferred — 후속 PRD `design-system-v1-1-enforcement-stage2-4` 로 분기 (M3 dogfood 측정 결과에 따라 도입 여부 결정)."* — 기존 line 68 footnote (단계적 활성화) 직후 |
| 3 | 측정 method 5개 지표 × source 매핑 박제 | ✅ Complete (plan 본문 §Tasks Task 3) | Stage 2/3/4 미활성으로 ❌/⚠️ marker 명시. Stage 1 활성 ✅ 2건 (plan 단계 인용도 + PR self-check checklist), Stage 3 ⚠️ 1건 (수동 review), Stage 4 ❌ 1건 (Vitest snapshot 측정 불가) |
| 4 | 측정 대상 PR sample 선정 기준 박제 | ✅ Complete (plan 본문 §Tasks Task 4) | 시점 `git log abc98ba..HEAD --oneline`, 카운트 3건, 정의 `services/web/src/{pages,widgets,shared/ui}/` 시각 변경 포함, family 별 ≥ 1건 권장 (auth/drive/admin), 본 plan 머지 PR 및 백엔드 위주 PR 제외 |
| 5 | Reporting location + template skeleton 박제 | ✅ Complete (plan 본문 §Tasks Task 5) | Path: `.claude/reports/design-system-v1-1-m3-dogfood-report.md` (main 디렉토리 — worktree archive 시 손실 방지). Template: Sample 표 + Task 3 표 5 row fill-in + E1~E5 카운트 + 한계 (Stage 2/3/4 미활성 분리) + 결론 (hypothesis 부분 검증 + 후속 PRD 권고/유보 + v1.2 보정 PRD 필요 여부) |
| 6 | Stage 2~4 후속 PRD 분기 형식 박제 | ✅ Complete (plan 본문 §Tasks Task 6) | slug: `design-system-v1-1-enforcement-stage2-4`. hypothesis: *"Stage 2 → Stage 3 → Stage 4 가 false-positive ≤ N건/PR 조건에서 순차 통합되면, Stage 1 부분 검증을 4단 완전 검증으로 확장한다"*. acceptance: *"각 Stage 별 false-positive 측정값 + 도구 호환성 PoC + 단계적 활성화 게이트 통과 시점 박제"* |
| 7 | 측정 실행 | ⏸️ Deferred — 본 plan acceptance 범위 외부 | design PR 3건 도착 후 별도 *측정 commit* 으로 `.claude/reports/design-system-v1-1-m3-dogfood-report.md` 작성 (Task 5 template skeleton 적용). PRD M3 status 는 측정 결과 도출 후 `done` 으로 갱신 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Plan §Validation `grep '^\| 2 \|.*\| done (phase 1 only'` | ✅ Pass | line 85 hit |
| Plan §Validation `grep '^\| 3 \|.*\| blocked'` | ✅ Pass | line 86 hit |
| Plan §Validation `grep 'completed/design-system-v1-1-enforcement'` | ✅ Pass | line 85 hit (PRD M2 row 의 archive 경로 link) |
| Plan §Validation `grep 'enforcement-stage2-4'` (PRD) | ✅ Pass | line 69 (footnote) + line 85 (M2 Outcome) — 2건 hit |
| Plan §Validation `grep -c 'Measurement source'` (plan 본문) | ✅ Pass | 2건 (≥ 1 요구) |
| Plan §Validation `grep -c 'Template skeleton'` (plan 본문) | ✅ Pass | 2건 (≥ 1 요구) |
| Plan §Validation `grep -c 'enforcement-stage2-4'` (plan 본문) | ✅ Pass | 10건 (≥ 3 요구) |
| Plan §Validation `grep -c 'grep-able marker'` (plan 본문) | ✅ Pass | 7건 (≥ 2 요구) |
| Type-check / Lint / Test / Build | N/A | 코드 변경 0건 — markdown 전용 |
| EOL 정책 (CRLF) | ⚠️ 확인 필요 | 본 worktree 의 hookify.enforce-crlf-default 가 신규 plan 파일 작성 시 검증/변환 명령 제공 — commit 전 사용자가 확인 |

## Files Changed

| File | Action | Lines |
|---|---|---|
| [`.claude/prds/design-system-v1-1-foundations.prd.md`](../prds/design-system-v1-1-foundations.prd.md) | UPDATE | +3 / -2 (M2/M3 row 갱신 + §Scope footnote 1줄 추가) |
| [`.claude/plans/design-system-v1-1-m3-dogfood-verification.plan.md`](../plans/design-system-v1-1-m3-dogfood-verification.plan.md) | CREATE | +213 (측정 plan 본문) |

## Deviations from Plan

| # | Deviation | Why |
|---|---|---|
| 1 | **/ecc:prp-implement Phase 5 의 "Archive Plan" 단계 스킵** — 본 plan 을 `.claude/plans/completed/` 로 이동하지 않음 | plan §Risks 가 *long-running open 상태* 를 명시 + plan §후속 작업 의 "측정 reporting" 항목이 측정 commit 시 본 plan 의 reporting template skeleton 을 참조해야 하므로 *open 위치 유지 필요*. PRD M3 status 가 `done` 으로 갱신될 때 (= 측정 결과 도출 후) 함께 archive |
| 2 | Report path 가 default `.claude/PRPs/reports/` 가 아닌 `.claude/reports/` | 본 프로젝트 컨벤션 — `.claude/reports/` 가 기존 enforcement / dogfood-fix / admin-pr61-followup report 의 정착 위치. `.claude/PRPs/` 디렉토리는 존재하지 않음 |
| 3 | commit 단계는 본 workflow 에서 스킵 — staging 까지만 | CLAUDE.md "커밋은 사용자 명의로만 생성" 정책 + /ecc:prp-implement Phase 6 의 "Next step: Run `/prp-commit` ..." — commit 은 사용자가 명시적으로 호출하는 단계 |

## Issues Encountered

| Issue | Resolution |
|---|---|
| 초기 `cd .worktrees/...` 명령이 *이미 worktree 안에 있던* shell 에서 실패 (No such file or directory) | `pwd` 로 cwd 확인 후 worktree 루트 기준 상대 경로로 재시도 — 정상 동작. multi-track worktree 환경의 흔한 패턴 |
| `.claude/PRPs/reports/` 디렉토리 부재 (workflow 의 default) | 본 프로젝트 컨벤션인 `.claude/reports/` 로 이전 — 기존 report 형식을 mirror |

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| — | — | N/A — markdown 전용 변경, plan §Validation grep 으로 대체 |

## 후속 작업

1. **본 PR 머지 후** — design PR 3건 도착 trigger 까지 indefinite wait. plan §Tasks Task 4 의 sample 정의 적용 (`git log abc98ba..HEAD --oneline` + `git diff abc98ba..HEAD --stat services/web/src/{pages,widgets,shared/ui}/`).
2. **측정 commit** — `.claude/reports/design-system-v1-1-m3-dogfood-report.md` 작성 (plan §Tasks Task 5 template skeleton 적용). PRD M3 row 의 `blocked` → `done` 갱신 (측정 착수 시 `in-progress` 경유) + 본 plan 을 `.claude/plans/completed/` 로 이동.
3. **Stage 2~4 후속 PRD 도입** — 본 plan §Tasks Task 6 의 slug/hypothesis/acceptance 를 출처로 `/ecc:plan-prd` 로 `design-system-v1-1-enforcement-stage2-4.prd.md` 신설. M3 측정 결과의 Stage 1 단독 효과 평가에 따라 도입 여부 결정.
4. **(조건부) v1.2 보정 PRD** — E1~E5 패턴 재현 ≥ 1건 시 mobile-ui-guide v1.1 의 *어느 anchor 가 검출 실패했는지* 분석 → v1.2 보정 PRD 도출.

## Next Steps

- 변경 사항은 *staging 전 상태* — PRD update + 신규 plan 파일 2건이 working tree 에 있음 (`git status` 로 확인 가능).
- `/prp-commit` 또는 `git add .claude/prds/... .claude/plans/...` + 사용자 명의 commit 으로 진행.
- 권장 commit message subject (한글 + plan §Acceptance 박제 요구): `chore(design-system): v1.1 milestone 2 closure + milestone 3 dogfood-verification plan 신설` — body 에 "plan archive (abc98ba) + PRD sync + 후속 plan 도입 한 작업 단위" 박제.
- 본 PR 생성 후 `/code-review` 로 사전 리뷰 권장 — markdown-only 변경이지만 PRD ↔ plan ↔ report 3자 일관성을 cross-check.

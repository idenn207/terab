---
name: design-system-v1-1-foundations
description: mobile-ui-guide.md v1.1 — 색상·타이포·atomic step gate 명시 + plan/PR/code-review 3단 강제 메커니즘
status: DRAFT
created: 2026-05-29
---

# design-system v1.1 — Color · Typography · Atomic Step Enforcement Foundations

## Problem

신규 페이지·컴포넌트가 mobile-ui-guide.md 의 시각 정책을 *권장 수준* 으로만 따르고 있어, 다크모드·색상 일관성·Layout 통일·컴포넌트 재사용성 결함 4종이 PR 리뷰를 통과해 dogfood 단계까지 살아남는다. 본인은 디자이너가 아니라 사전 판정이 불가하고, 미래의 Claude 세션은 *디자인 의사결정의 권위 출처*가 없어 표류한다. 그 비용은 별도 worktree (`design-system-v1-dogfood-fix`) 신설 + 잔존 catalyst 어휘의 무의식적 재생산.

## Evidence

| # | 관찰된 사례 | 위반 정책 | 출처 |
|---|---|---|---|
| E1 | 다크모드: Login 페이지는 적용, 2FA challenge 페이지는 검정 배경 + 검정 text — WCAG 1.4.3 위반 | mobile-ui-guide §4.1, §7.2 | [[project_design_system_v1_phase2_dogfood]] 결함 1 |
| E2 | DriveLayout 이 catalyst 시각 어휘 답습 — §8.2 식별 범위는 `shared/ui/catalyst/**` import 만 보므로 *어휘 답습 위젯/레이아웃* 검출 불가 | §8 catalyst 정책 식별 범위 한계 | 본 worktree FRAME Q2-c 답변 |
| E3 | 신규 컴포넌트가 primary/accent color 미사용 — 같은 화면 안에서 강조색 일관성 깨짐 | §5.2 색상 의미 단위, §7.3 anti-template | FRAME Q2-c 답변 |
| E4 | 동일 페이지 family(Login / 2FA) 의 Layout 통일 부재 | §5.1 위계, §2.4 Navigation 일관성 | FRAME Q2-c 답변 |
| E5 | 다른 branch 에서 개별 작업 중인 결과물이 컴포넌트 재사용 없이 직접 작성 — 재사용성 저하 | §8.3 핵심 8개 + 잔여 컴포넌트 사용 규약 부재 | FRAME Q4 답변 |
| E6 | mobile-ui-guide.md 의 모든 항목이 *권장 + 수동 PR 점검* 수준 (§8.4 catalyst lint rule 외 자동화 0건) — E1~E5 가 PR 리뷰를 통과해 dogfood 단계까지 살아남은 *근본 원인* | 강제 메커니즘 부재 | GROUND 답변 |

## Users

- **Primary**: 본인(개발자) + 미래의 Claude 세션. 디자인 작업 시 Claude 의 의사결정이 *guideline 부재로 표류*하고, 본인은 디자이너가 아니라 사후 dogfood 점검 외에 사전 검증 수단이 없다.
- **Not for**: 외부 디자이너 / 기여자. v1.0–v1.1 은 단독 사용자 + Claude 세션 전제.

## Hypothesis

우리는 **(a) Tailwind Plus UI Blocks 를 anatomy 출처로 채택 + (b) atomic step-by-step gate + (c) 색상 60/30/10 시각 비율 + (d) 폰트 modular scale 사용처 매핑 + (e) 페이지(군) → token 사용 매핑** 을 mobile-ui-guide.md v1.1 로 박제하고, 각 정책을 **(1) plan 단계 디자인 결정 checklist + (2) PR 작성 시점 self-check + (3) Claude code-review 시 cross-check + (4) Vitest snapshot 페이지군 token 회귀 test** 4단 강제 메커니즘으로 도입하면, **본인 + 미래 Claude** 가 mobile-app-feel phase 2 dogfood 결함 4종(다크모드 / 색상 일관성 / Layout 통일 / 컴포넌트 재사용성) 을 **plan 단계부터 인지·차단**한다고 믿는다.

이 가설은 **v1.1 정책 박제 후 신규 PR 3건의 plan + PR self-check + code-review cross-check 3단계에서 E1~E5 패턴 검출 0건 → dogfood 단계 재현 0건** 이면 검증된다.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Plan 단계 디자인 결정 명시도 | 신규 design 관련 plan 100% 가 v1.1 §색상 / §타이포 / §atomic gate 인용 + 결정 명시 | plan.md grep |
| PR self-check checklist 통과 | 신규 design 관련 PR 100% 가 v1.1 체크리스트 전 항목 체크됨 | PR template render |
| code-review 의 design 일관성 지적 | v1.1 도입 후 신규 PR 3건 누적 0건 | code-reviewer agent 출력 |
| Dogfood 단계 design 결함 재현 | 0건 (E1~E5 동일 패턴 한정) | dogfood report 분류 |
| Vitest 페이지군 token 회귀 detection | 회귀 PR 100% 차단 (baseline 확보 후) | snapshot diff |

## Scope

**MVP** — 4개 deliverable + 4단 강제 메커니즘 모두 포함 (사용자 의사 확인됨)

### Deliverables — mobile-ui-guide.md patch

| # | Deliverable | 갱신 위치 |
|---|---|---|
| M1 | §2.2 anatomy 표에 *출처 column* 추가 — Material URL + Tailwind UI Blocks URL 병기 (라이선스 footnote) | §2.2 |
| M2 | §5.2 색상 system — 60/30/10 시각 비율 규칙 명시 + 페이지(또는 페이지군) → token 사용 매핑 표 | §5.2 갱신 + 신규 §5.5 |
| M3 | §5.1 폰트 위계 — modular scale × 사용처 (header / body / meta / caption) 매핑 표 | §5.1 갱신 |
| M4 | 신규 §9 — atomic step-by-step gate (Atoms → Molecules → Organisms → Templates → Pages) + 각 step acceptance criteria | 신규 §9 |

### 강제 메커니즘 — 4단 cross-check

| Stage | 메커니즘 | 산출물 |
|---|---|---|
| 1. Plan 단계 | plan.md 안에 v1.1 §색상 / §타이포 / §atomic gate 인용 + 결정 명시 (ecc:plan skill 의 디자인 sub-checklist) | ecc:plan 의 plan template patch |
| 2. PR 작성 시점 | PR template 의 *디자인 일관성 self-check checklist* 7~10건 + `git grep` 기반 pre-commit hook (catalyst 어휘 답습 detection 범위 확장 — §8.2 의 식별 한계 보강) | `.github/PULL_REQUEST_TEMPLATE.md` patch + pre-commit script |
| 3. Code-review 시점 | code-reviewer agent prompt 에 *v1.1 §5 / §9 cross-check 항목* 추가 + `eslint-plugin-tailwindcss` token allowlist (Tailwind 4 호환성은 plan 첫 task 에서 검증) | agent prompt patch + eslint config |
| 4. Vitest snapshot | 페이지군 단위 token 사용 회귀 test (기존 pages 의 baseline 확보 후 회귀 자동 차단) | `services/web/src/pages/__tests__/` |

> 4단 동시 도입의 false-positive 리스크는 **단계적 활성화** mitigation 으로 처리 — Risks 표 참조.
> Stage 1 = M2 phase 1 (#73 머지). Stage 2/3/4 = deferred — 후속 PRD `design-system-v1-1-enforcement-stage2-4` 로 분기 (M3 dogfood 측정 결과에 따라 도입 여부 결정).

### Out of scope — v1.1 에서 명시적으로 안 함

- catalyst 잔존 컴포넌트(DataTable / ComboBox / DatePicker / NavBar) 의 headless 마이그레이션 — v1.X 별도 PRD
- 다크모드 전면 활성화 — `design-system-v1-dogfood-fix` worktree 책임
- Capacitor safe-inset 적용 — `design-system-v1-dogfood-fix` worktree 책임
- 2FA challenge 페이지 UI 신설 — `mobile-app-feel-phase2` worktree 책임
- Tailwind Plus 라이선스 *구매 결정* — 사용자 보유 확정 (FRAME Q3 답변), 본 PRD 의 결정 범위 밖
- 60/30/10 의 정량 측정 도구 도입 — *시각적 황금 비율 의도 명시*만, 정밀 측정은 v1.2 이후

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | mobile-ui-guide.md §2.2 / §5.1 / §5.2 / §5.5 / §9 patch (M1~M4) | 디자인 정책이 명시 + 강제 가능 표 형태로 박제됨 | done (commit d65ab43, PR #67, 2026-05-29) | [design-system-v1-1-foundations.plan.md](../plans/design-system-v1-1-foundations.plan.md) |
| 2 | 4단 cross-check 강제 메커니즘 도입 (plan checklist + PR template + agent prompt + eslint + Vitest snapshot) — Stage 2~4 는 후속 PRD `design-system-v1-1-enforcement-stage2-4` 로 분기 | claude / 사용자가 plan / PR / review 3단계 자동 차단 가능 | done (phase 1 only — 4단 중 stage 1, commit 889bc95 시점 acceptance 충족, sync commit TBD) | [completed/design-system-v1-1-enforcement.plan.md](../plans/completed/design-system-v1-1-enforcement.plan.md) |
| 3 | 신규 design PR 3건 dogfood 검증 — hypothesis 측정 | E1~E5 패턴 재현 0건 확인 또는 정책 보정 PRD 도출 | blocked (design PR 3건 도착 대기) | [design-system-v1-1-m3-dogfood-verification.plan.md](../plans/design-system-v1-1-m3-dogfood-verification.plan.md) |

## Open Questions

- [ ] **페이지군(family) 그루핑 규칙** — `pages/login` + `pages/2fa` 를 한 family 로 묶을지 별개로 둘지. 현재는 무규칙(FRAME Q4 답변). 본 PRD 가 결정해야 함. *plan M2 의 첫 task 로 결정* — 후보: route prefix 단위(`/auth/*`, `/drive/*`, `/admin/*`).
- [ ] **`eslint-plugin-tailwindcss` × Tailwind 4 `@theme` 호환성** — TBD. *plan 첫 task 에서 Claude 가 직접 테스트 후 보고* (FRAME Q4 답변 지시). 비호환 시 대안: custom ESLint rule 또는 `npm run` 기반 token grep.
- [ ] **60/30/10 의 표현 수준** — 사용자 의도는 "시각적 황금 비율" 명시. plan 단계에서 *가이드 표현 정밀도* (예: "지배색 ≥ 60% 의 시각 면적" vs "background-* token 만 60% 영역에 사용") 결정.
- [ ] **atomic step gate 의 acceptance criteria 수준** — 각 step 통과 조건이 *체크리스트 형태* 인지 *test/snapshot 형태* 인지. plan M4 에서 결정.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tailwind Plus URL 인용이 라이선스 회색지대 — 본인 보유라도 *공개 repo 의 URL pin* 자체가 ToS 위반 가능 | low | medium | plan 단계에서 Tailwind Plus ToS 의 *URL 인용 허용 범위* 확인 후 §2.2 의 URL 표기 방식 (footnote / private wiki link / inline 인용) 결정 |
| 강제 메커니즘 4단 동시 도입이 기존 PR 흐름을 *과도하게 차단* — false positive 로 작업 부담 가중 | medium | medium | 단계적 활성화 — 1단(plan checklist) 만 머지 후 2~3개 PR 표본으로 false-positive 측정 → 2단·3단·4단 순차 활성 |
| `eslint-plugin-tailwindcss` 가 Tailwind 4 비호환 — 강제 메커니즘 3단의 핵심 도구 부재 | medium (Open Q2 검증 전) | high | plan 첫 task 의 호환성 검증 결과에 따라 대안 (custom rule, `npm run` token grep) 으로 대체. 본 PRD 의 hypothesis 자체는 메커니즘 종류 무관 |
| 페이지군 family 그루핑이 너무 fine-grained 하면 *매핑 표 폭발* — 신규 페이지마다 정책 추가 부담 | medium | low | family 그루핑을 *route prefix 단위* (예: `/auth/*`, `/drive/*`, `/admin/*`) 로 제한 — plan M2 첫 task |
| 본 PRD merge 가 `design-system-v1-dogfood-fix` worktree 의 mobile-ui-guide.md patch 와 충돌 | medium | medium | 본 PRD 의 patch 범위는 §2.2 / §5.1 / §5.2 / §5.5 / §9 — dogfood-fix 의 patch 범위(§4 contrast 보강 / §5.3 safe-inset) 와 *교차 0건* 유지. plan 단계에서 충돌 가능 라인 cross-check |

---

*Status: DRAFT — requirements only. Implementation planning pending via `/ecc:plan .claude/prds/design-system-v1-1-foundations.prd.md`.*

## 참고 박제

- [[mobile-ui-guide-v1-1-additions]] memory — 본 PRD 의 안건 출처 (Tailwind UI Blocks + atomic + 60/30/10 + 폰트 스케일)
- [[project_design_system_v1_phase2_dogfood]] memory — Evidence E1 (다크모드 결함) 출처
- `.worktrees/design-system-v1/.claude/reports/design-system-v1-review-fix-report.md` line 150–158 — v1.1 정책 추가 안건 표
- mobile-ui-guide.md §1 권위 우선순위 표 — v1.1 patch 가 *기존 5단계 source 와 동등한 권위* 인지 *상위 게이트* 인지 결정 필요 (plan M1 첫 task)

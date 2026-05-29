---
slug: design-system-v1-1-foundations
status: complete
milestone: 1
prd: .claude/prds/design-system-v1-1-foundations.prd.md
worktree: .worktrees/design-system-v1-1
branch: docs/design-system-v1-1
base: v0.1
---

# Plan — design-system v1.1 milestone 1 foundations

## 요약

[PRD design-system-v1-1-foundations](../prds/design-system-v1-1-foundations.prd.md) 의 **Milestone 1 (mobile-ui-guide.md patches)** 를 구현한다. PRD M1 deliverable 4건(§2.2 / §5.1 / §5.2 + §5.5 / §9) 을 본 plan 의 7-patch 로 매핑하며, PRD Open Questions 4건 중 3건을 본 plan 에서 결정 종결한다 (OQ2 는 M2 task 로 인계).

**코드 변경 없음 — *정책 문서 1개의 7-patch* 가 본 milestone 1 의 산출.** Hypothesis 검증 (PRD §Success Metrics 의 "Dogfood 단계 design 결함 재현 0건") 은 본 plan 범위 밖 — PRD M3 의 신규 design PR 3건 dogfood 단계에서 측정.

## PRD ↔ plan 매핑

| PRD Deliverable | PRD 위치 | 본 plan task | mobile-ui-guide.md anchor |
|---|---|---|---|
| **M1** §2.2 anatomy 출처 column (Material + Tailwind UI Blocks 병기, 라이선스 footnote) | PRD §Scope M1 | Task 2 (Tailwind UI Blocks 참조 정책 footnote — URL *미*인용) | §2.2 footnote |
| **M2** §5.2 60/30/10 + 페이지군 token 매핑 | PRD §Scope M2 | Task 4 (§5.2.1) + Task 5 (§5.5) | line 215 / line 244 |
| **M3** §5.1 modular scale × 사용처 매핑 | PRD §Scope M3 | Task 3 (§5.1.1) | line 185 |
| **M4** §9 atomic step-by-step gate | PRD §Scope M4 | Task 6 (§9 신설) | line 422 |
| *보강* — §1 권위 보강 결정 단락 | PRD §Risks "Tailwind Plus URL 라이선스 회색지대" mitigation | Task 1 (§1 권위 보강 결정) | line 75 |
| *보강* — 종료 체크리스트 v1.1 4행 | PRD §Scope "강제 메커니즘 1단 plan checklist" 의 seed | Task 7 (종료 체크리스트 v1.1 4행) | line 468-471 |

## Open Question 결정 (PRD 의 OQ 4건 중 3건 종결)

PRD §Open Questions 4건의 본 plan 시점 결정 상태.

| PRD OQ | 내용 | 결정 | 근거 / 인계 |
|---|---|---|---|
| **OQ1** 페이지군 family 그루핑 | **route prefix 단위 (`/auth/*` / `/drive/*` / `/admin/*`)** | §5.5 표 3행이 이 결정을 박제 | PRD §Risks "family 그루핑 fine-grained 폭발" mitigation 과 일관 |
| **OQ2** `eslint-plugin-tailwindcss` × Tailwind 4 호환성 | **본 plan 범위 외 — Milestone 2 인계** | M1 (정책 문서 patch) 은 lint 도구 무관. M2 의 강제 메커니즘 3단 (code-review eslint) 의 task | PRD §Risks "eslint-plugin-tailwindcss 비호환" 자체가 M2 의 핵심 task |
| **OQ3** 60/30/10 표현 수준 | **(a) 정성 표현** — "지배색 ≥ 60% / 보조색 ≤ 30% / 강조색 ≤ 10% 의 시각 면적 비율" (픽셀 측정 X) | §5.2.1 본문 "측정은 정성 기준(스크린샷의 시선 인상)" 로 박제 | PRD §Risks "60/30/10 정량 측정 도구 v1.2 이후" 와 일관 |
| **OQ4** atomic step gate acceptance | **체크리스트 (M1) + Vitest snapshot (M2)** | §9.2 Acceptance gate 에서 두 단계 모두 명시 | PRD §"강제 메커니즘 4단" 중 1단(plan checklist) + 4단(Vitest) 매핑 |

## Files

| 파일 | 변경 종류 | 비고 |
|---|---|---|
| [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) | edit (7 patch) | 코드 변경 없음 — 정책 문서. base ≈ 287줄 → patched 471줄. |

## Tasks (Milestone 1, 본 PR 범위)

| # | Task | Source 인계 | Anchor (patched line) | 상태 |
|---|---|---|---|---|
| 1 | §1 권위 표 뒤 "v1.1 권위 보강 결정" 단락 — Tailwind Plus 미인용 + dogfood 보강분 안내 | OQ 1.1 | line 75 | ✅ |
| 2 | §2.2 anatomy 표 뒤 "Tailwind UI Blocks 참조 정책" footnote — markup paste 금지, anatomy/token/a11y 재해석 | OQ 1.1 | §2.2 footnote | ✅ |
| 3 | §5.1 위계 4단계 뒤 §5.1.1 "modular scale × 사용처 매핑" 표 — 7행 (`--text-xs` ~ `--text-3xl`) | catalyst dogfood 정착 패턴 | line 185 | ✅ |
| 4 | §5.2 의미 표 뒤 §5.2.1 "60/30/10 시각 비율" 표 + 정성 규칙 3개 | OQ 1.2 | line 215 | ✅ |
| 5 | §5.4 인계 뒤 §5.5 "페이지군 → token 사용 매핑" 표 — 3행 (auth/drive/admin) | OQ 1.3 | line 244 | ✅ |
| 6 | §8.5 catalyst 끝 뒤 §9 "Atomic step-by-step gate" 신설 — 5단계 매핑 + 체크리스트 acceptance + Milestone 2 인계 | OQ 1.4 | line 422 | ✅ |
| 7 | 종료 체크리스트 끝 v1.1 신규 4행 추가 (각 patch 와 cross-link) | Tasks 1~6 의 PR-리뷰 게이트 | line 468-471 | ✅ |

## Tasks (Milestone 2 인계 — 별도 plan)

핵심 8개 headless 컴포넌트(Button / Input / Modal / Toast / Tooltip / Select / Checkbox / Radio) 에 대해 §9.2 의 Milestone 2 acceptance — Vitest snapshot 으로 anatomy/token/a11y attribute 회귀 자동 차단. 별도 plan slug: `design-system-v1-1-vitest-snapshots` (예정).

## Validation

| # | 검증 | 결과 |
|---|---|---|
| V1 | Patch 7개가 의도한 anchor 에 정확히 들어갔는지 | `Grep ^### v1\.1` / `^#### 5\.1\.1` / `^#### 5\.2\.1` / `^### 5\.5` / `^## 9` / `^- \[ \] \*\*\(v1\.1\)` — 모두 hit ✅ |
| V2 | 파일 line count 정상 (충돌·중복 없이 patch 분 만큼만 증가) | base ≈ 287 줄 → patched 471 줄 (+184). 적정 ✅ |
| V3 | design-system-v1-dogfood-fix worktree 의 patch range(@@ -244 / @@ -285, §6 영역) 과 *내용* 충돌 0건 | 본 plan 의 7 patch 모두 §6 외부 (§1, §2.2, §5.x, §5.4/§6 사이, §8.5/§9 사이, 종료 체크리스트). §6 자체는 비터치 — *content 충돌 0건*. merge 시 line shift 만 발생 (git 3-way 자동 해결) ✅ |
| V4 | 외부 cross-link 가 모두 worktree 안에 존재 | [tokens.css](../../services/web/src/shared/styles/tokens.css) / [coding-style.md](../rules/ecc/web/coding-style.md) / [design-quality.md](../rules/ecc/web/design-quality.md) / [PRD design-system-v1](../prds/design-system-v1.prd.md) — 4개 cross-link 모두 존재 ✅ |
| V5 | Markdown table syntax · 한국어 형식 일관 | patch 7건 모두 *기존 문체* 와 동일 (한글 단문, ` 백틱, `→` 흐름 화살표, *italic* emphasis 패턴) ✅ |

## Risks

| Risk | 영향 | 대응 |
|---|---|---|
| dogfood-fix worktree 가 merge 될 때 line shift 가 발생 | merge conflict marker 가능 (낮음) | merge 시 §5.5 가 §6 위에 보존되는지 PR 본문에서 cross-link 명시 |
| 본 patch 가 *정책 문서만* 갱신 — 실제 컴포넌트가 §9 체크리스트를 안 따라도 PR 통과 가능 | Milestone 2 까지 *PR 리뷰 인간* 게이트만 작동 | Milestone 2 의 Vitest snapshot 이 진짜 자동 게이트. M1 PR 본문에 명시 |
| §5.5 의 admin family default 가 *현재 코드* 와 부분 불일치 (admin bootstrap 가 PR #61 으로 막 들어옴) | 정책이 aspirational 인지 현황 기록 인지 모호 | §5.5 본문 "family default — 페이지 단위에서 override 할 수 있지만 family 톤이 무너지면 PR 리뷰에서 호출" 이 *aspirational* 임을 명시. admin scope 확장 시 §5.5 갱신 PR |
| 비커밋 worktree 손상으로 작업 손실 재발 위험 (2026-05-29 1회 발생) | 다음 세션도 worktree 손상되면 본 plan + PRD 도 손실 | 본 plan 은 patch 적용 직후 *최우선 commit* — patches + plan 을 *같은 commit* 으로 atomic 보장. PRD 는 user 가 별도 복원 (2026-05-29 완료) |

## 후속 작업 (PRD M2 / M3 인계)

- **PRD M2 — 4단 강제 메커니즘 도입** (plan checklist / PR template / agent prompt + eslint / Vitest snapshot)
  - 별도 plan: `design-system-v1-1-enforcement-4-stage` (예정) — PRD OQ2 (`eslint-plugin-tailwindcss` × Tailwind 4 호환성) 의 첫 task 가 여기 들어감
  - 본 plan 의 mobile-ui-guide.md §9.3 체크리스트는 이 4단 메커니즘의 *seed* — `.github/PULL_REQUEST_TEMPLATE/web-component.md` 로 직접 이식
- **PRD M3 — 신규 design PR 3건 dogfood 검증** (E1~E5 패턴 재현 0건 측정)
  - hypothesis 검증 단계. PRD §Success Metrics 의 5개 지표가 측정 기준
- **catalyst 잔존 사용처** (DataTable / ComboBox / DatePicker / NavBar) — `design-system-v1-1-catalyst-residuals` (v1.X 별도 PRD, PRD §Out of scope)

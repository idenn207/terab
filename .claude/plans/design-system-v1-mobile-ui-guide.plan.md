---
name: design-system-v1-mobile-ui-guide
description: design-system-v1 PRD Milestone 1 — mobile-ui-guide.md 신설 + 루트/web CLAUDE.md 에 web rules 참조 박제
status: done
created: 2026-05-28
---

# Plan: design-system-v1 — Milestone 1 (mobile-ui-guide 박제)

## Summary

services/web 의 v1.0 디자인 시스템 기반을 다른 세션의 claude 가 **자동으로 인용**하도록, (a) `.claude/rules/ecc/web/mobile-ui-guide.md` 를 신설해 Android Material 1순위·Apple HIG 보편 원칙·WCAG 2.2 AA·Refactoring UI·TailwindCSS utility-first 컨벤션·trend 허용/금지 목록·catalyst 임시 정책을 박제하고, (b) 루트 [CLAUDE.md](../../CLAUDE.md) 와 [services/web/CLAUDE.md](../../services/web/CLAUDE.md) 에 `.claude/rules/ecc/web/*` 일괄 참조 블록을 한 번에 추가한다. 코드 변경 없이 문서 산출물 3건만 손대고, Milestone 2(headless 컴포넌트 마이그레이션)·Milestone 3(catalyst 표면화 + 신규 import 차단)의 reference 가 모두 갖춰진 상태에서 종료한다.

## Selected Milestone

- **Source PRD**: [.claude/prds/design-system-v1.prd.md](../prds/design-system-v1.prd.md)
- **Selected**: Milestone 1 — `mobile-ui-guide.md 박제 + CLAUDE.md 참조 추가`
- **Why this first**: Milestone 2 의 headless 컴포넌트는 가이드(Android Material anatomy / WCAG / 토큰 사용법)를 *참조*하면서 만들어야 하고, Milestone 3 의 lint rule 도 가이드의 "신규 catalyst import 금지" 정책을 권위 source 로 삼는다. Milestone 1 이 박제되지 않은 상태에서 2·3 을 시작하면 가이드가 코드 작성 과정에 *역공학적으로 정해지는* 결함이 재발한다.

## Problem → Solution

**현재 상태**:
- 루트 [CLAUDE.md](../../CLAUDE.md) 는 `.claude/plans/` · `.claude/hookify.*` · `docs/` 만 참조하고 `.claude/rules/ecc/web/*.md` 는 한 번도 인용하지 않는다 (`grep "rules/ecc" CLAUDE.md` → 0건). 이미 존재하는 [design-quality.md](../rules/ecc/web/design-quality.md) · [coding-style.md](../rules/ecc/web/coding-style.md) 조차 다른 세션이 자동 로드할 진입점이 없다.
- [services/web/CLAUDE.md L182](../../services/web/CLAUDE.md) 는 "UI 라이브러리: `shared/ui/catalyst/` — 직접 수정 금지, 확장 필요 시 래핑 컴포넌트 작성" 으로 catalyst 를 *보강 대상*으로 적어 두어, PRD 의 "임시·마이그레이션 대상" 정책과 정면 충돌한다.
- 디자인 톤·터치 타깃·a11y 기준이 모두 암묵지로 남아 있어 PR 마다 다른 톤의 컴포넌트가 생긴다 (PRD Evidence §1·§2).

**목표 상태**:
- `.claude/rules/ecc/web/mobile-ui-guide.md` (≤800 라인) 가 신설되어 Android Material / HIG / WCAG / Refactoring UI / Tailwind 컨벤션 / trend 큐레이션 / catalyst 임시 정책을 단일 source 로 박제한다.
- 루트 CLAUDE.md 에 `.claude/rules/ecc/web/*` 참조 블록이 추가되어 모든 새 세션이 자동 로드한다.
- services/web/CLAUDE.md L182 문단이 "catalyst — 임시·마이그레이션 대상, 신규 코드에서 catalyst import 금지" 로 갱신된다.

## Metadata

- **Complexity**: Small (코드 변경 0건, 문서 산출물 3건 — 신설 1·갱신 2)
- **Estimated Files**: 3 (CREATE 1, UPDATE 2)
- **Estimated Duration**: 0.5~1일 (outline 확정 0.25일 + 본문 작성 0.5일 + CLAUDE.md 참조 박제 0.1일 + 검증 0.15일)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | [.claude/prds/design-system-v1.prd.md](../prds/design-system-v1.prd.md) | all | Hypothesis / Scope / Success Metrics / Open Questions — 가이드 본문 outline 의 직접 input |
| P0 | [services/web/src/shared/styles/tokens.css](../../services/web/src/shared/styles/tokens.css) | all | 가이드가 *재정의하지 않고 참조*해야 할 토큰 표 (--color-accent / --motion-ease-spring / --radius-pill 등) |
| P0 | [.claude/rules/ecc/web/design-quality.md](../rules/ecc/web/design-quality.md) | all | "Anti-Template Policy" — mobile-ui-guide 의 "금지 목록" 섹션이 중복되지 않도록 경계 짓기 |
| P0 | [.claude/rules/ecc/web/coding-style.md](../rules/ecc/web/coding-style.md) | all | Tailwind 컨벤션 / `cn()` 유틸 / 컴포지터 친화 motion property — 중복 없이 가이드에서 *재참조* |
| P0 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | 177-210, 453-490 | 컴포넌트 컨벤션 + catalyst 정책 L182 갱신 위치 + Claude 행동 지침 |
| P0 | [CLAUDE.md](../../CLAUDE.md) | 117-167 | "Claude 행동 지침" / "개발 워크플로우(ECC)" — rules 참조 블록을 어디 끼울지 결정 |
| P1 | [.claude/rules/ecc/web/](../rules/ecc/web/) | dir | 이미 존재하는 8개 rule 파일 (coding-style / design-quality / fsd / hooks / patterns / performance / security / testing) — 일괄 참조 블록의 entries |
| P1 | [.claude/plans/services-web-feature-parity-phase1-design-spike.plan.md](services-web-feature-parity-phase1-design-spike.plan.md) | 1-80 | 인접 plan 의 frontmatter / Patterns to Mirror / Validation 섹션 구조 — 본 plan 의 모범 |
| P1 | [.claude/plans/README.md](README.md) | all | plan frontmatter + 명명 규칙 + PRD ↔ plan 매칭 정책 |
| P2 | [docs/design/direction.md](../../docs/design/direction.md) | all | (존재 시) Phase 1 design spike 산출물 — mobile-ui-guide 가 합의된 방향과 어긋나지 않는지 교차 확인 |

## External Documentation

> Research & Reuse(필수): mobile-ui-guide 본문의 anatomy/dimension 수치는 *반드시* 외부 표준 출처를 직접 인용한다 — 본 plan 의 Task 1 에서 출처/버전을 못박는다.

| Topic | Source | Key Takeaway / Version Pin |
|---|---|---|
| Material Design 3 — touch target & component anatomy | https://m3.material.io | 48dp minimum touch target / FAB / TopAppBar / Snackbar anatomy — 인용 시 *섹션 URL* 까지 적시 |
| Apple HIG — universal principles | https://developer.apple.com/design/human-interface-guidelines | 가독성·손가락 도달성·모달의 책임감 — iOS 빌드 무관, "보편 원칙"으로만 차용 |
| WCAG 2.2 — Level AA | https://www.w3.org/TR/WCAG22/ | 1.4.3 Contrast (4.5:1) / 2.1.1 Keyboard / 2.4.7 Focus Visible / 1.4.11 Non-text Contrast |
| Refactoring UI — visual hierarchy | https://www.refactoringui.com | 위계는 weight/color 보다 *scale & whitespace* 우선 — 토큰 사용 예시의 근거 |
| TailwindCSS 4 — utility-first + `@theme` | https://tailwindcss.com/docs/theme | `--color-*`/`--font-*`/`--spacing-*` → utility class 자동 노출. 가이드의 "토큰 사용법" 섹션 근거 |

---

## Patterns to Mirror

> 새 가이드 본문과 plan 모두 *기존 컨벤션을 재발명하지 않는다*. 아래 항목은 그대로 답습.

| Category | Source | Pattern |
|---|---|---|
| 가이드 markdown 구조 | [.claude/rules/ecc/web/design-quality.md](../rules/ecc/web/design-quality.md) | H1 + 짧은 도입 + "Banned/Required" 섹션 + 체크리스트로 마무리 (frontmatter 없음 — rules 는 무 frontmatter) |
| 가이드 분량 통제 | [.claude/rules/ecc/web/coding-style.md:1-95](../rules/ecc/web/coding-style.md) | 한 파일 ~100 라인, 단일 주제 응집 — mobile-ui-guide 는 단일 파일 800 라인 한도(PRD Scope) |
| 표 기반 의사결정 surface | [.claude/rules/ecc/web/performance.md](../rules/ecc/web/performance.md) | Metric/Target/How measured 식 표 — Android dimension / WCAG criterion 모두 동일 포맷 |
| 부정 예시 명시 | [.claude/rules/ecc/web/design-quality.md "Banned Patterns"](../rules/ecc/web/design-quality.md) | "Do not …" 식으로 금지 목록을 *나란히* 명시 — mobile-ui-guide 의 trend 금지 목록(bootstrap-style/glassmorphism)도 동일 포맷 |
| 루트 CLAUDE.md 참조 박제 방식 | [CLAUDE.md L135 hookify 참조 라인](../../CLAUDE.md) | `[hookify.xxx](.claude/hookify.xxx.local.md)` 인라인 링크 — rules 도 동일 인라인 링크로 박제 |
| services/web/CLAUDE.md 정책 갱신 톤 | [services/web/CLAUDE.md L182-184](../../services/web/CLAUDE.md) | 한 문단 1~3 줄, 결정 + 이유 + 권장 행동 순 — catalyst 갱신 문단도 동일 톤 |
| plan frontmatter | [.claude/plans/README.md frontmatter 표](README.md) | `name`/`description`/`status`/`created` 4개 키만 사용, 날짜 prefix 금지 |
| plan 본문 섹션 순서 | [.claude/plans/services-web-feature-parity-phase1-design-spike.plan.md](services-web-feature-parity-phase1-design-spike.plan.md) | Summary → Problem→Solution → Metadata → Mandatory Reading → Patterns → Files → Tasks → Validation → Risks → Acceptance |

---

## Files to Change

| # | File | Action | Why |
|---|---|---|---|
| 1 | `.claude/rules/ecc/web/mobile-ui-guide.md` | CREATE | 가이드 본문 (≤800 라인). PRD Hypothesis(a) 의 핵심 산출물 |
| 2 | `CLAUDE.md` (루트) | UPDATE | `.claude/rules/ecc/web/*` 일괄 참조 블록 추가 — 모든 새 세션의 자동 로드 트리거 |
| 3 | `services/web/CLAUDE.md` | UPDATE | L182 catalyst 문단을 "임시·마이그레이션 대상" 톤으로 갱신 + 가이드 cross-link |

> 경계 짓기: Milestone 2 의 headless 컴포넌트 신설(`services/web/src/shared/ui/{button,input,...}/`) 과 Milestone 3 의 lint rule / catalyst README 는 **이 plan 의 out-of-scope**. 본 plan 종료 시점에 코드 1줄도 바뀌지 않는다.

---

## Tasks

### Task 1: 가이드 outline + 외부 출처 표 확정

- **Action**:
  - mobile-ui-guide.md 의 8개 섹션 outline 을 한 차례에 확정: ①요약·1순위 결정·읽는 순서, ②Android Material 3 (touch target / anatomy / motion / navigation), ③Apple HIG 보편 원칙, ④WCAG 2.2 AA criterion 표, ⑤Refactoring UI 위계, ⑥TailwindCSS utility-first 컨벤션 + tokens.css 사용법, ⑦trend 큐레이션 (허용/v1.1 검토/금지), ⑧catalyst 임시 정책 + Milestone 2/3 으로의 인계 표.
  - 각 섹션의 외부 출처를 *섹션 단위 URL*로 박제 (Material `m3.material.io/components/buttons`, WCAG `w3.org/TR/WCAG22/#contrast-minimum` 식 — root URL 만 두지 않음).
  - 섹션별 예상 라인수를 견적해 800 라인 한도 안에 들어가는지 *Task 2 진입 전*에 결정. 초과 견적이면 PRD Open Question §2(분할 옵션) 발동.
- **Mirror**:
  - [.claude/rules/ecc/web/design-quality.md "Banned Patterns" + "Required Qualities" 2단 구성](../rules/ecc/web/design-quality.md) — trend 큐레이션 섹션이 동일 2단 패턴 답습.
  - [.claude/rules/ecc/web/performance.md "Bundle Budget" 표](../rules/ecc/web/performance.md) — WCAG criterion 표가 동일 포맷.
- **Validate**:
  - outline 마크다운 헤더만 적은 stub 파일을 `wc -l` 으로 측정해 *공백 outline 기준 30~50 라인* 이내인지 확인 (본문 채우면 5~10배 팽창 가정).
  - 외부 출처 표가 PRD External Documentation 표와 *충돌 없이 보강*인지 cross-check (PRD 는 5행, plan 은 동일 5행을 유지하고 가이드 본문에서 *섹션 단위 URL* 만 늘림).

### Task 2: `.claude/rules/ecc/web/mobile-ui-guide.md` 본문 작성

- **Action**:
  - Task 1 outline 을 본문으로 채운다. 각 섹션은 다음 4요소를 가진다 — (a) 결정 한 줄, (b) 표 또는 bullet 로 dimension/criterion, (c) "어긋났을 때 어떻게 보이는가" 부정 예시, (d) Milestone 2 의 8개 컴포넌트가 이 섹션을 *어떻게 인용해야 하는지* 한 줄 인계.
  - 토큰은 [tokens.css](../../services/web/src/shared/styles/tokens.css) 의 이름으로만 인용 (`--color-accent` / `--motion-ease-spring` 식). 새 토큰 값을 *발명*하지 않는다.
  - "충돌 시 Android Material 우선" 규칙을 §2 와 §3 둘 다에 명시 (한 곳에만 적으면 다른 세션이 §3 만 읽고 HIG 우선으로 오해할 위험).
  - catalyst 정책 §8 은 "신규 코드에서 catalyst import 금지 — 정당화는 Milestone 3 lint rule 로 자동화 예정" 으로 *향후 자동화의 권위 source* 임을 명시.
  - Markdown 한국어 본문, 코드 식별자·command·URL 은 영어 유지 (루트 CLAUDE.md "응답" 규칙).
- **Mirror**:
  - [.claude/rules/ecc/web/coding-style.md "CSS Custom Properties" 코드 블록](../rules/ecc/web/coding-style.md) — tokens.css 사용법 코드 블록의 포맷.
  - [.claude/rules/ecc/web/design-quality.md "Required Qualities" 10가지 번호 목록](../rules/ecc/web/design-quality.md) — Refactoring UI 섹션의 위계 원칙도 번호 목록.
- **Validate**:
  - `wc -l .claude/rules/ecc/web/mobile-ui-guide.md` → 결과가 **≤800** (PRD Success Metrics §4).
  - `markdownlint` (있다면) 또는 수동 헤더 레벨 검수 — H1 1개, H2 8개(섹션), 그 외 H3.
  - 모든 외부 URL 이 HTTP 200 응답인지 표본 5건 `curl -I` (4xx 발생 시 즉시 교체).

### Task 3: 루트 `CLAUDE.md` 에 `.claude/rules/ecc/web/*` 참조 박제

- **Action**:
  - 루트 [CLAUDE.md](../../CLAUDE.md) 의 "## Claude 행동 지침" 섹션 끝(현재 L151) 직후, "### 디자인·UI" 한 소섹션을 신설.
  - 한 줄 인용 + 표(또는 bullet) 형태로 `.claude/rules/ecc/web/*` 8+1 개 파일(기존 8개 + 신설 mobile-ui-guide.md)을 모두 link 으로 박제. mobile-ui-guide.md 는 *Mobile/Web UI 작업 시 항상 우선 인용* 임을 명시.
  - 한 줄 안에 "v1.0 디자인 시스템 정책 — mobile-ui-guide.md 가 모든 web/mobile UI 의 1차 출처" 식 의도 한 문장.
- **Mirror**:
  - [CLAUDE.md L135 hookify 참조 라인](../../CLAUDE.md) — `[link-text](relative-path)` 인라인 형태. 표 형태는 [CLAUDE.md L172-175 worktree 자동화 표](../../CLAUDE.md) 답습.
- **Validate**:
  - `grep "rules/ecc/web" CLAUDE.md | wc -l` → **≥9** (8 기존 + mobile-ui-guide).
  - `grep "mobile-ui-guide" CLAUDE.md | wc -l` → **≥1**.
  - 추가된 문단의 줄 수 ≤15 (루트 CLAUDE.md 의 일관된 톤 보존).

### Task 4: `services/web/CLAUDE.md` 의 catalyst 정책 문단 갱신

- **Action**:
  - [services/web/CLAUDE.md L182](../../services/web/CLAUDE.md) 의 "UI 라이브러리: `shared/ui/catalyst/` — 직접 수정 금지, 확장 필요 시 래핑 컴포넌트 작성" 1줄을, *catalyst 의 임시성*을 명시한 1~3 줄 문단으로 교체.
  - 새 문단 골자: **"catalyst 는 v1.0 출시 전 헤드리스 마이그레이션 대상(임시). 신규 컴포넌트는 `shared/ui/{component}/` 헤드리스 버전을 생성한다. 정책 출처: `.claude/rules/ecc/web/mobile-ui-guide.md`. 마이그레이션 진행은 PRD `design-system-v1` Milestone 2."**
  - 같은 파일 L460 "컴포넌트 작성 전 `shared/ui/catalyst/`에 재사용 가능한 기반 컴포넌트가 있는지 확인한다" 줄도 같은 톤으로 갱신 — *catalyst 에서 찾지 말고 mobile-ui-guide.md 가이드에 따라 headless 버전 작성을 우선 검토*.
  - 가이드 cross-link 1줄 추가 — "디자인 시스템 규칙: `.claude/rules/ecc/web/mobile-ui-guide.md`".
- **Mirror**:
  - [services/web/CLAUDE.md L182-184 "스타일 / 클래스 조합" 3줄 컴팩트 결정 톤](../../services/web/CLAUDE.md).
- **Validate**:
  - `grep "임시\|마이그레이션 대상\|catalyst" services/web/CLAUDE.md | head -5` 에서 *임시·마이그레이션* 키워드가 명시되는지 확인.
  - "직접 수정 금지, 확장 필요 시 래핑 컴포넌트 작성" 문자열이 **남아있지 않아야** 함 (`grep -c "확장 필요 시 래핑" services/web/CLAUDE.md` == 0).

---

## Validation

### 정적 검증 (CLI)

```bash
# 1) 가이드 신설 + 라인 한도
test -f .claude/rules/ecc/web/mobile-ui-guide.md \
  && [ "$(wc -l < .claude/rules/ecc/web/mobile-ui-guide.md)" -le 800 ] \
  && echo "OK: guide exists and within 800-line cap"

# 2) 루트 CLAUDE.md 참조 박제
grep -q "mobile-ui-guide" CLAUDE.md \
  && [ "$(grep -c "rules/ecc/web" CLAUDE.md)" -ge 9 ] \
  && echo "OK: root CLAUDE.md references mobile-ui-guide + all web rules"

# 3) services/web/CLAUDE.md catalyst 임시 정책
grep -q "임시" services/web/CLAUDE.md \
  && grep -q "mobile-ui-guide" services/web/CLAUDE.md \
  && ! grep -q "확장 필요 시 래핑" services/web/CLAUDE.md \
  && echo "OK: web/CLAUDE.md catalyst paragraph rotated"

# 4) 외부 URL 표본 reachability (수동 — Task 2 종료 시 1회만)
grep -oE 'https?://[^)]+' .claude/rules/ecc/web/mobile-ui-guide.md | sort -u | head -5 \
  | xargs -I {} curl -sI -o /dev/null -w "%{http_code} {}\n" {}
```

### 시멘틱 검증 (수동, 다른 세션 시뮬레이션)

- 새 worktree (예: `.worktrees/mobile-ui-guide-smoke/`) 를 잠시 만들거나 같은 worktree 내 새 claude 세션을 띄워, "web 에 'Files 페이지' UI 추가" 식 prompt 로 `/ecc:plan-prd` 작성을 *지시 없이* 시작. 출력 plan 의 본문에 (a) `mobile-ui-guide.md` 인용, (b) Android Material 48dp touch target 또는 WCAG 4.5:1 중 한 항목, (c) "catalyst 사용 대신 headless" 권고 중 **3건 모두 등장**해야 통과. — PRD Success Metrics §1 의 직접 확인.

### 회귀 (코드 영향 없음)

- 본 plan 은 `services/` 산하 코드를 *한 줄도 손대지 않는다*. `git diff --stat services/` 결과는 0건. `pnpm build` / `pnpm tsc` 결과가 plan 전후 동일해야 한다.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 가이드 본문이 800 라인 초과 → PRD Success Metrics §4 위반 | Medium | Medium | Task 1 에서 outline 30~50 라인일 때 본문 견적 산출 → 초과 예상 시 *분할*(`mobile-ui-guide/index.md` + `components.md` + `tokens.md` + `a11y.md`) 로 즉시 전환. 분할 시 루트 CLAUDE.md 참조도 index.md 만 박제. |
| 신설 가이드와 기존 `design-quality.md` / `coding-style.md` 내용 중복 → 충돌 시 권위 source 모호 | High | Medium | mobile-ui-guide.md §1 에 *"본 가이드는 mobile-first 디자인 시스템·a11y·trend 큐레이션·catalyst 정책의 1차 출처. 일반 디자인 품질(anti-template) 은 design-quality.md, Tailwind/CSS 컨벤션은 coding-style.md 가 1차 출처. 충돌 시 mobile-ui-guide.md 우선"* 명시. |
| 다른 세션 claude 가 가이드를 *인용은 하지만 실제 적용은 하지 않음* | Medium | Medium | PRD Risk 표의 동명 항목 mitigation 을 Milestone 1 종료 시점에 *PRD 만 갱신*. 본 plan 종료 후 code-reviewer agent 의 체크리스트 보강은 Milestone 2 plan 의 task. |
| catalyst 임시 정책 박제 직후 `services/web/` 내 신규 PR 이 catalyst import 를 계속 추가 (Milestone 3 lint rule 부재) | Medium | Low | mobile-ui-guide.md §8 에 "신규 catalyst import 금지 — 자동 차단은 Milestone 3 lint rule. 그 전까지는 PR 리뷰에서 grep 으로 수동 점검" 명시. 본 plan 의 종료 정의에 lint rule 은 포함하지 않는다 (그건 Milestone 3 plan). |
| 루트 CLAUDE.md 참조 블록 추가가 다른 자동화(claude-code 자체 / hookify) 와 충돌 | Low | Low | 신설 소섹션은 "## Claude 행동 지침" 안에만 들어가고 기존 줄을 *삭제하지 않는다*. 추가만 한다. |
| Android Material vs HIG 우선순위 모호로 가이드 적용 일관성 결손 | Medium | Low | mobile-ui-guide.md §2·§3 도입 1줄에 모두 "충돌 시 Android Material 우선 — iOS 빌드 없음" 박제 (PRD Risk 표 동명 항목 mitigation 답습). |

---

## Acceptance

- [ ] `.claude/rules/ecc/web/mobile-ui-guide.md` 가 신설되어 있고 라인 수가 **≤800** 이다.
- [ ] 본문이 8개 섹션(요약·Material·HIG·WCAG·Refactoring UI·Tailwind/tokens·trend·catalyst)을 모두 포함하고, 각 섹션이 (a) 결정 1줄 (b) 표/리스트 (c) 부정 예시 (d) Milestone 2 인계 1줄의 4요소를 갖춘다.
- [ ] 외부 URL 인용은 모두 *섹션 단위 URL* 이고 표본 5건이 HTTP 200 으로 응답한다.
- [ ] 토큰은 [tokens.css](../../services/web/src/shared/styles/tokens.css) 의 이름으로만 인용되고 새 토큰 값이 발명되지 않았다.
- [ ] 루트 [CLAUDE.md](../../CLAUDE.md) 에 `.claude/rules/ecc/web/*` 일괄 참조 블록이 추가되어 있고, `grep -c "rules/ecc/web" CLAUDE.md` ≥ 9 이다.
- [ ] [services/web/CLAUDE.md L182 주변 catalyst 정책 문단](../../services/web/CLAUDE.md) 이 "임시·마이그레이션 대상" 톤으로 갱신되고, "확장 필요 시 래핑 컴포넌트 작성" 문자열이 더 이상 존재하지 않는다.
- [ ] 본 plan 적용 후 `git diff --stat services/` 결과가 *services/web/CLAUDE.md 외 0건*이다 (코드 무변경 보증).
- [ ] PRD [.claude/prds/design-system-v1.prd.md Delivery Milestones 표](../prds/design-system-v1.prd.md) 의 Milestone 1 row 가 `pending` → `in-progress` 로 갱신되고 Plan 셀에 본 파일 경로가 박혀 있다.
- [ ] (수동, 종료 시점) 새 claude 세션이 "web 에 임의 UI 추가" prompt 만으로 mobile-ui-guide.md 를 자동 인용한다 (3건 표본 모두에서 (a) 가이드 인용 (b) Material 48dp 또는 WCAG 4.5:1 (c) catalyst 대신 headless 권고 3요소 등장).

---

## Open Questions (plan 시작 전 결정)

1. **mobile-ui-guide.md 단일 파일 vs 분할** — PRD Open Question §2 의 동명 사안. *기본은 단일 파일* (Task 2 진입 시 800 라인 한도 안에 들어가면 그대로). 초과 견적이면 즉시 분할 (`mobile-ui-guide/{index,components,tokens,a11y}.md` 4분할 안).
2. **루트 CLAUDE.md 에 박는 참조 범위** — *mobile-ui-guide.md 단독*이 아니라, 기존 web rules 8개 + 신설 1개를 *일괄* 박제하기로 결정 (Insight 의 구조적 결함 — 기존 web rules 가 아예 참조 안 됨 — 을 동시에 해소). 분할 시에도 루트는 index.md 1줄만 참조.
3. **services/web/CLAUDE.md L460 라인의 운명** — "컴포넌트 작성 전 catalyst 에서 재사용 확인" 문장은 *Milestone 2 종료 시점*에 "shared/ui 에서 headless 버전 확인"으로 완전 교체 예정. 본 plan 에서는 임시로 "catalyst 에서 찾지 말고 mobile-ui-guide 의 권장에 따라 headless 우선 검토" 톤으로만 *완화*한다.

---

*Status: PENDING — `/ecc:prp-implement .worktrees/design-system-v1/.claude/plans/design-system-v1-mobile-ui-guide.plan.md` 로 구현 진입.*

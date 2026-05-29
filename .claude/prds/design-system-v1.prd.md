# design-system-v1 — Web 디자인 가이드 박제 + 핵심 컴포넌트 headless 마이그레이션

## Problem
현재 services/web은 빠른 개발을 위해 catalyst UI를 임시 채용한 상태이며, 색상·디자인·프로퍼티가 모두 예시일 뿐 v1.0 정식 디자인 시스템이 부재하다. 이로 인해 두 가지 문제가 동시에 발생한다 — (1) v1.0 출시 시 일관된 시각적 정체성·접근성·플랫폼 친화도 보장이 불가능하고, (2) 다른 세션에서 실행되는 claude가 디자인 가이드를 알 길이 없어 매 PR마다 다른 톤의 컴포넌트를 만들어내며 catalyst 종속이 점점 깊어진다. 가이드와 핵심 컴포넌트 마이그레이션을 미루면 v1.1 시점의 마이그레이션 비용이 기하급수적으로 커진다.

## Evidence
- **catalyst가 임시임을 본인이 명시 선언함**: 본 PRD 트리거 — "catalyst ui … 빠른 개발과 예시를 위해 임시로 존재할 뿐 v1.0에서는 직접 구성한 headless component로 구성되어야돼."
- **다른 세션이 매번 무지 상태로 진입하는 구조적 결함**: 본인 명시 — "다른 세션에서 실행하는 claude도 모두 알아야돼." 현재 [services/web/CLAUDE.md](../../services/web/CLAUDE.md)는 catalyst 사용 규칙(`shared/ui/catalyst/` 직접 수정 금지)은 명시되어 있으나 catalyst가 임시이며 마이그레이션 대상이라는 정책은 없음.
- **모바일 first-impression 임박**: PRD A `mobile-app-feel`이 v1.0 출시 직전 모바일 기본기를 잡지만, 시각 디자인 자체가 catalyst 기본 톤(범용 SaaS dashboard 톤)이라 Android Material 친화도와 product 정체성 모두 부재.
- **참조 가능한 토큰 인프라는 부분 존재**: [services/web/src/shared/styles/tokens.css](../../services/web/src/shared/styles/tokens.css)에 색상/타이포/spacing/radius/duration 토큰이 이미 설계되어 있어 headless 마이그레이션의 기반은 마련됨. 단 PRD A에서 발견된 것처럼 safe-area 토큰처럼 정의만 되고 사용처가 0건인 토큰도 혼재.

## Users
- **Primary (1차)**: 새 worktree에서 web 관련 plan을 작성·실행하는 모든 claude 세션. 가이드가 자동 로드되어 별다른 지시 없이도 Android Material 친화 + WCAG 2.2 + Refactoring UI 원칙에 맞는 컴포넌트를 제안한다.
- **Primary (2차)**: v1.0 모바일/웹 사용자 (Android 우선). 일관된 시각 정체성과 플랫폼 친화 UX를 받는다.
- **Not for**: iOS 사용자 (iOS 빌드 자체 미포함). Apple HIG는 "플랫폼 보편 UX 원칙"으로만 차용 — Android Material과 충돌 시 Android Material 우선.

## Hypothesis
**(a) `.claude/rules/ecc/web/mobile-ui-guide.md`를 신설해 디자인 가이드(Android Material 1순위, Apple HIG 보편 원칙, WCAG 2.2 AA, Refactoring UI 시각 위계, TailwindCSS utility-first 컨벤션)를 영속화하고, (b) 루트 `CLAUDE.md`와 `services/web/CLAUDE.md`에서 이 가이드를 참조하도록 박아두며, (c) catalyst를 명시적으로 "임시·마이그레이션 대상"으로 표기하고 핵심 컴포넌트(Button, Input, Modal, Toast, Tooltip, Select, Checkbox, Radio)를 v1.0에 맞춰 headless로 교체**하는 것이 — 다른 세션의 claude가 매번 다른 톤의 컴포넌트를 만드는 일관성 결손을 제거하고 v1.0의 시각 정체성·접근성·Android 친화도를 확보할 것이다.

**검증 신호**: 본 PRD 적용 이후 새 worktree에서 임의의 web 관련 `/ecc:plan-prd` 또는 `/ecc:plan`을 작성할 때, **별도 지시 없이도** plan이 `mobile-ui-guide.md`를 자동 참조해 (1) Android Material 친화적 컴포넌트, (2) WCAG 2.2 AA 준수, (3) catalyst 사용 대신 headless 경로를 제안한다.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| 가이드 자동 참조율 (새 web plan에서 mobile-ui-guide.md 인용) | 100% | 신규 plan 3건 표본 검증 — "web에 X 추가" 식 plan을 3회 작성해 모두에서 가이드 또는 그 핵심 원칙(Android Material, 48dp touch target 등)을 인용하는가 |
| 핵심 8개 컴포넌트의 catalyst 의존 제거 | 8/8 | `git grep "from '@/shared/ui/catalyst/{Component}'"` 결과 0건 |
| 가이드 적용 컴포넌트의 WCAG 2.2 AA 통과 | 100% | axe-core 자동 점검 + 키보드 navigation 수동 점검 |
| 가이드 길이 (오버스펙 방지) | 800줄 이하 | `wc -l .claude/rules/ecc/web/mobile-ui-guide.md` |

## Scope

**MVP** — v1.0 출시 범위로 사용자가 체감할 결과

1. **디자인 가이드 영속화** — 다른 세션 claude가 자동으로 알도록
   - `.claude/rules/ecc/web/mobile-ui-guide.md` 신설. 본문 구성:
     - **Android Material 3 (1순위)**: 컴포넌트 anatomy, touch target ≥ 48dp, FAB 사용 시점, navigation/app bar 패턴
     - **Apple HIG 보편 원칙 (2순위, iOS 빌드 무관)**: 가독성·손가락 도달성·모달의 책임감·spatial consistency
     - **WCAG 2.2 AA**: color contrast 4.5:1, focus visible, keyboard navigation, ARIA 사용 시점
     - **Refactoring UI**: 시각 위계, 색상 system, spacing scale
     - **TailwindCSS utility-first 컨벤션**: 인라인 style 금지, `cn()` 유틸 사용, Tailwind UI anatomy 참조
     - **트렌드 큐레이션 허용 목록**: bento layout, 의미 있는 motion, dark luxury 검토 (v1.1)
     - **금지 목록 (negative examples)**: bootstrap-style 균일 디자인(정체성 부재), glassmorphism(GPU 부담 + 가독성 trade-off)
     - **catalyst 정책**: "임시·마이그레이션 대상. 신규 코드에서 catalyst import 금지"
   - 루트 `CLAUDE.md`에 한 줄 참조 추가 — 모든 세션 자동 로드.
   - `services/web/CLAUDE.md`에 catalyst 정책 1문단 추가.

2. **핵심 8개 컴포넌트 headless 마이그레이션**
   - 대상: Button, Input, Modal, Toast, Tooltip, Select, Checkbox, Radio
   - 각 컴포넌트는 (a) catalyst의 모양·색상·프로퍼티를 답습하지 않고, (b) 가이드의 token (tokens.css)을 활용하며, (c) ARIA·키보드·focus state를 직접 구현한다.
   - 위치: services/web FSD 컨벤션에 따라 `shared/ui/{component}/` (예: `shared/ui/button/Button.tsx`).
   - 기존 catalyst 사용처는 `@/shared/ui/catalyst/{Component}` → `@/shared/ui/{component}` 로 전수 교체.

3. **catalyst 종속 표면화 + 신규 import 차단**
   - `shared/ui/catalyst/` 디렉토리에 README 추가 — "이 디렉토리는 v1.X에 제거됩니다. 신규 코드에서 import 금지" 명시.
   - lint rule(eslint or grep-based check)로 신규 코드의 catalyst import를 경고/차단. PRD 완료 후 신규 catalyst import 0건.

**Out of scope** (PRD B v1.0에서 명시적으로 제외 — v1.1 이후로 미룸)
- 핵심 8개 외 catalyst 사용처의 headless 마이그레이션 (DataTable, ComboBox, DatePicker, NavBar 등)
- iOS 빌드 및 iOS HIG의 strict 적용 (Apple HIG는 보편 원칙으로만 차용)
- Dark mode 구현 (가이드에는 "dark luxury 검토" 항목만 — 실제 구현은 v1.1+)
- 디자인 토큰 자체의 재설계 (현재 tokens.css 유지, 가이드에서 활용만)
- Storybook / 문서 사이트
- 모션 라이브러리(Framer Motion, gsap 등) 채택 결정 (v1.1 모션 가이드에서 결정)
- 다국어 (i18n) 정책
- 트렌드 후보 중 bootstrap-style, glassmorphism은 가이드에서도 금지 — 차후에도 채택 안 함

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | mobile-ui-guide.md 박제 + CLAUDE.md 참조 추가 | 모든 새 claude 세션이 web plan 작성 시 가이드를 자동 로드하고 인용함 | done | [design-system-v1-mobile-ui-guide.plan.md](../plans/design-system-v1-mobile-ui-guide.plan.md) |
| 2 | 핵심 8개 컴포넌트 headless 마이그레이션 | catalyst의 8개 컴포넌트 사용처 0건, headless 버전이 WCAG 2.2 AA 통과 | done | [design-system-v1-headless-migration.plan.md](../plans/completed/design-system-v1-headless-migration.plan.md) |
| 3 | catalyst 종속 표면화 + 신규 import 차단 | 신규 catalyst import 시 경고, README로 마이그레이션 대상임을 선언 | pending | — |

## Open Questions
- [ ] **headless 라이브러리 채택 vs 100% 직접 구현** — Radix UI / Headless UI / ariakit / 0 dep 직접 구현 중 plan 단계에서 결정. trade-off: 직접 구현 = ARIA 정확성 위험·코드 부담 / 라이브러리 = 의존성 추가·번들 사이즈
- [ ] **mobile-ui-guide.md 구조** — 단일 파일 vs 분할(`mobile-ui-guide/index.md` + `components.md` + `tokens.md` + `a11y.md`). 800줄 한도 안에 들어가면 단일, 넘으면 분할

## Risks
| Risk | Likelihood | Impact | Mitigation 방향 (plan에서 확정) |
|---|---|---|---|
| 가이드가 길어져 claude 컨텍스트를 과다 점유 | Medium | Medium | 800줄 한도 + 분할 옵션 + 핵심 원칙 요약 섹션 |
| 8개 컴포넌트 마이그레이션 중 사용처 누락 → 런타임 import error | Medium | High | catalyst → headless 교체 시 git grep + lint check 강제 |
| 다른 세션의 claude가 가이드를 인용은 하지만 실제 적용은 하지 않음 | Low | Medium | code-reviewer agent 체크 항목에 mobile-ui-guide.md 준수 추가 |
| Android Material 1순위 vs Apple HIG 보편 원칙 충돌 시 판단 모호 | Medium | Low | 가이드 본문에 "충돌 시 Android Material 우선" 명시 |
| catalyst → headless 마이그레이션이 v1.0 출시 일정 압박 | Medium | High | "핵심 8개"로 범위 한정 + 나머지는 v1.1 명시적 미루기 |
| 직접 구현 시 ARIA 정확성 결함 (예: focus trap 누락) | Medium | Medium | headless 라이브러리 채택 옵션을 plan에서 우선 검토 |

---
*Status: DRAFT — requirements only. Implementation planning pending via `/ecc:plan .worktrees/design-system-v1/.claude/prds/design-system-v1.prd.md`.*

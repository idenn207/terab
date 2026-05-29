> This file extends [web/design-quality.md](./design-quality.md) with mobile-first design-system v1.0 specifics for `services/web`. Anti-template gate(일반 디자인 품질) 와 Tailwind/`cn()` 컨벤션은 각각 [design-quality.md](./design-quality.md) · [coding-style.md](./coding-style.md) 가 1차 출처로 남는다.

# Mobile UI Guide — services/web v1.0

services/web 는 단일 빌드(웹 + Capacitor Android WebView)로 배포된다. 본 가이드는 그 단일 빌드가 모바일(Android 우선) 환경에서 시각 정체성·접근성·플랫폼 친화도를 일관되게 갖추기 위한 1차 출처다. *충돌 시 Android Material 우선 — iOS 빌드는 v1.0 범위에 없다.*

## 1. 요약 · 1순위 · 읽는 순서

**1순위 결정**: 본 가이드는 (a) 모바일 friendly 디자인 시스템, (b) 접근성(WCAG 2.2 AA), (c) trend 큐레이션, (d) catalyst 임시 정책의 1차 출처다. 일반 디자인 품질(anti-template)은 [design-quality.md](./design-quality.md), Tailwind/CSS 컨벤션·`cn()` 유틸 사용법은 [coding-style.md](./coding-style.md) 가 1차 출처다. **세 문서가 충돌하면 본 가이드 우선.**

### 권위 우선순위

| 순위 | 기준 | 출처 |
|---|---|---|
| 1 | Android Material 3 | https://m3.material.io |
| 2 | Apple HIG (보편 원칙만) | https://developer.apple.com/design/human-interface-guidelines |
| 3 | WCAG 2.2 Level AA | https://www.w3.org/TR/WCAG22/ |
| 4 | Refactoring UI (시각 위계) | https://www.refactoringui.com |
| 5 | Tailwind 4 utility-first | https://tailwindcss.com/docs |

> Material 과 HIG 가 충돌하면 Material 우선. Material/HIG 와 WCAG 가 충돌하면 WCAG 우선(접근성은 미적 결정을 압도). 그 외 충돌은 본 가이드 §2~§8 의 명시 규칙으로 판단.

### 읽는 순서

1. 처음 읽는 세션은 §1 → §2 → §4 → §6 → §8 을 우선 (Material anatomy / a11y / token / catalyst).
2. 컴포넌트 1개 신설 시 §2 (anatomy) + §4 (focus/contrast) + §6 (token) 3개 섹션을 cross-check.
3. 신규 trend 채택 논의 시 §7 (허용/v1.1 검토/금지) 표만 확인.

### 적용 범위

- 본 가이드는 `services/web/src/**` 의 모든 컴포넌트·페이지·widget 에 적용된다.
- `android/**` (Capacitor 네이티브 plugin·리소스) 는 본 가이드 범위 밖 — [services/web/CLAUDE.md "Android / Capacitor 컨벤션"](../../../../services/web/CLAUDE.md) 이 1차 출처.
- 본 가이드는 *코드 패턴이 아닌 시각·a11y·정책 결정*만 다룬다. FSD 슬라이스 배치는 [services/web/CLAUDE.md "FSD 레이어 의존 규칙"](../../../../services/web/CLAUDE.md) 참조.

---

## 2. Android Material 3 (1순위)

**결정**: services/web 의 모든 인터랙티브 표면은 Material 3 의 dimension·anatomy·motion 규약을 1순위로 따른다. *충돌 시 Material 우선 — iOS 빌드는 v1.0 범위에 없다.* iOS Safari 에서 보더라도 Material 톤이 일관되게 보이는 편이, 두 플랫폼을 어중간하게 흉내내다 양쪽 다 어색해지는 것보다 낫다.

### 2.1 Touch target — 최소 dimension

| Property | Value | 출처 |
|---|---|---|
| 최소 touch target | **48dp × 48dp** (≈ 48px @1x, 96px @2x) | https://m3.material.io/foundations/accessible-design/overview |
| 인접 target 간 최소 간격 | 8dp | 위 동일 |
| 일반 본문 lineHeight 기반 spacing | ≥ `--spacing-gutter` (clamp 1~1.5rem) | [tokens.css](../../../../services/web/src/shared/styles/tokens.css) |

**부정 예시** — `<button className="h-6 w-6">`(24×24px) 단독 아이콘 버튼. Material/WCAG 양쪽 위반. 시각적으로 24px 이 적절해 보여도 *padding 으로 hit-area 를 48dp 까지 확장*하거나 (`p-3` 등) inline transparent border 로 보강한다.

### 2.2 Component anatomy

각 컴포넌트는 Material 3 의 anatomy(요소 구성 + 상태)를 답습한다. v1.0 핵심 8개는 [PRD design-system-v1 Milestone 2](../../../../.claude/prds/design-system-v1.prd.md) 가 직접 마이그레이션 대상.

| 컴포넌트 | Material 출처 | v1.0 채택 결정 |
|---|---|---|
| Button (filled / tonal / outlined / text) | https://m3.material.io/components/buttons/overview | filled = `--color-accent` / outlined = `--color-border-strong` / text = 무 배경 |
| Floating Action Button (FAB) | https://m3.material.io/components/floating-action-button/overview | "1차 행동이 단 1개" 인 페이지에서만 사용. drive 업로드 트리거에 한해 채택 후보 |
| Top App Bar | https://m3.material.io/components/top-app-bar/overview | center-aligned 채택 — drive 페이지 헤더 |
| Navigation Bar (bottom) | https://m3.material.io/components/navigation-bar/overview | mobile breakpoint(<768px) 에서 채택, desktop 은 좌측 sidebar |
| Snackbar / Toast | https://m3.material.io/components/snackbar/overview | duration: short=4000ms / long=10000ms. action 1개 한도 |
| Modal Bottom Sheet | https://m3.material.io/components/bottom-sheets/overview | mobile breakpoint 의 모달 1차 선택, desktop 은 centered dialog |
| Text Field | https://m3.material.io/components/text-fields/overview | filled variant 채택, outlined 는 form 밀도 높은 경우만 |
| Switch / Checkbox / Radio | https://m3.material.io/components/switch/overview | switch 는 boolean, checkbox 는 다중 선택, radio 는 단일 배타 — Material 의 의미 분리 그대로 |

> 디자인 결정은 anatomy 만 답습하고 *색상은 본 프로젝트 토큰만* 사용한다. Material 의 dynamic color palette 는 v1.0 미채택 (단일 `--color-accent` 로 통일).

**부정 예시** — Modal 을 desktop·mobile 동일 centered dialog 로 통일. mobile 에서 손가락 도달성·키보드 차단 면적 모두 악화. mobile=BottomSheet, desktop=Dialog 분기 필수.

### 2.3 Motion

| Token | Duration | Ease | 용도 |
|---|---|---|---|
| `--motion-duration-fast` | 120ms | `--motion-ease-out` | hover·focus state, micro-feedback |
| `--motion-duration-normal` | 220ms | `--motion-ease-out` | modal·toast enter, list item reorder |
| `--motion-duration-slow` | 360ms | `--motion-ease-in-out` | page transition, full-screen overlay |
| `--motion-ease-spring` | — | `cubic-bezier(0.34, 1.56, 0.64, 1)` | FAB·hero icon 의 진입(살짝 over-shoot) |

출처: https://m3.material.io/styles/motion/overview

**금지 property**: `width`/`height`/`top`/`left`/`margin` 의 직접 animate (layout thrash). 모든 motion 은 [coding-style.md "Animation-Only Properties"](./coding-style.md) 의 compositor-friendly 4종(`transform`/`opacity`/`clip-path`/`filter`) 만 사용.

**부정 예시** — drawer 를 `width: 0 → 320px` 로 animate. 매 frame layout 재계산. `transform: translateX(-100%) → 0` 로 교체.

### 2.4 Navigation

| Breakpoint | 1차 navigation | 비고 |
|---|---|---|
| < 768px (mobile) | Bottom Navigation Bar (Material) | 최대 5개 destination |
| ≥ 768px (tablet/desktop) | 좌측 Persistent Sidebar | drive·shared·trash·settings |

> back navigation 은 Android 의 system back gesture 와 WebView 가 자동 연결되므로 별도 in-app back button 은 *modal 안에서만* 사용. Capacitor Android back-button handler 는 [services/web/src/app/](../../../../services/web/CLAUDE.md) "Android / Capacitor 컨벤션" 참조.

### 2.5 Milestone 2 인계

핵심 8개 (Button / Input / Modal / Toast / Tooltip / Select / Checkbox / Radio) headless 마이그레이션은 §2.2 anatomy 표의 *Material URL* 을 컴포넌트별 outline source 로, §2.1 dimension 을 hit-area·spacing 검증 기준으로 사용한다.

---

## 3. Apple HIG — 보편 원칙만 (2순위)

**결정**: iOS 빌드는 v1.0 범위에 없으므로 HIG 의 *플랫폼 종속 규약(SF Symbols, swipe-back gesture, iOS Tab Bar)* 은 채택하지 않는다. *충돌 시 Android Material 우선 — iOS 빌드는 v1.0 범위에 없다.* 단 HIG 의 "보편 원칙"(가독성·손가락 도달성·모달의 책임감) 은 Material 과 어긋나지 않는 한 동등하게 적용한다.

### 3.1 채택하는 원칙

| 원칙 | 적용 | HIG 출처 |
|---|---|---|
| Clarity — 가독성 우선 | 본문 텍스트 weight ≥ 400, contrast ≥ WCAG AA, `--text-base` 이상 | https://developer.apple.com/design/human-interface-guidelines/foundations |
| Deference — UI 가 콘텐츠를 압도하지 않음 | drive 의 파일 그리드는 chrome 보다 콘텐츠가 시각적으로 우세 | 위 동일 |
| Direct manipulation — 손가락이 닿는 곳에 결과가 있음 | 파일 long-press → 인접 위치 context menu (drop-shadow modal 금지) | https://developer.apple.com/design/human-interface-guidelines/inputs |
| Modal 의 책임감 — 모달은 *진짜 결정*에만 | 단순 알림은 toast, 진짜 선택(파일 삭제 확인) 만 모달 | https://developer.apple.com/design/human-interface-guidelines/modality |

### 3.2 채택하지 않는 패턴

- **iOS Tab Bar (하단 5탭)** — Material Bottom Navigation Bar 로 대체. 두 패턴은 시각적으로 비슷하지만 *간격·아이콘 라벨 정렬·active state* 가 다르다.
- **swipe-from-edge back gesture** — Android 의 system back gesture 와 충돌 위험. WebView 가 자동 처리하는 OS back 만 사용.
- **SF Symbols** — 시스템 종속. lucide-react 또는 Tabler icon 등 cross-platform set 사용. 채택할 icon set 결정은 Milestone 2 의 task.
- **iOS bottom sheet detent step (small/medium/large)** — Material Bottom Sheet 의 단일 expand/collapse 만 채택.

### 3.3 Milestone 2 인계

핵심 8개 컴포넌트는 HIG 보편 원칙(가독성·직접 조작·모달의 책임감) 을 *디자인 리뷰 체크리스트* 로만 활용한다 — anatomy·dimension 의 source 는 항상 Material(§2).

---

## 4. WCAG 2.2 Level AA

**결정**: services/web 의 모든 표면은 WCAG 2.2 Level AA 를 통과한다. *Material/HIG 와 WCAG 가 충돌하면 WCAG 우선* — 미적 결정은 접근성을 압도하지 않는다.

### 4.1 적용 criterion

| Criterion | 요구 | 측정 | 출처 |
|---|---|---|---|
| 1.4.3 Contrast (Minimum) | 본문 ≥ 4.5:1, ≥18pt 또는 14pt bold 텍스트 ≥ 3:1 | axe-core / 수동 contrast checker | https://www.w3.org/TR/WCAG22/#contrast-minimum |
| 1.4.11 Non-text Contrast | UI component(border·icon·focus indicator) ≥ 3:1 | 위 동일 | https://www.w3.org/TR/WCAG22/#non-text-contrast |
| 2.1.1 Keyboard | 모든 인터랙티브 요소가 키보드로 도달·조작 가능 | Tab/Shift+Tab/Enter/Space/Esc 수동 점검 | https://www.w3.org/TR/WCAG22/#keyboard |
| 2.4.7 Focus Visible | focus 시 시각적 표시(아웃라인·배경·언더라인) 존재 | `:focus-visible` 스타일 점검 | https://www.w3.org/TR/WCAG22/#focus-visible |
| 2.4.11 Focus Not Obscured (Minimum) | focus 된 요소가 sticky header·footer 에 *완전히* 가려지지 않음 | 스크롤 + Tab 수동 점검 | https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum |
| 2.5.8 Target Size (Minimum) | 인터랙티브 target ≥ 24×24 CSS px (예외 inline link/spacing 보강 시) | hit-area 측정 | https://www.w3.org/TR/WCAG22/#target-size-minimum |
| 3.3.7 Redundant Entry | 같은 정보를 같은 process 안에서 두 번 입력 요구 금지 | 폼·플로우 리뷰 | https://www.w3.org/TR/WCAG22/#redundant-entry |
| 4.1.3 Status Messages | 알림(toast·error)은 focus 이동 없이 보조기술에 통지 (`aria-live`) | screen reader 표본 점검 | https://www.w3.org/TR/WCAG22/#status-messages |

> 2.5.8 의 24×24 CSS px 은 WCAG 최소. **본 프로젝트는 Material 의 48dp 를 우선 적용** (§2.1) — WCAG 는 floor, Material 은 target.

### 4.2 Focus indicator — 가이드 결정

- 기본 focus 는 `box-shadow: 0 0 0 2px var(--color-accent)` + `outline: 2px solid transparent` (Windows high-contrast 모드 호환).
- `:focus-visible` 만 사용 (`:focus` 단독 사용 금지 — 마우스 클릭 시 outline 노출).
- 어두운 배경의 컴포넌트는 `--color-accent` 가 대비 3:1 을 만족하지 않으면 `--color-accent-soft` ring 으로 교체.

### 4.3 ARIA — 사용 시점

- **먼저 native HTML.** `<button>`/`<a>`/`<input type="...">` 으로 표현 가능하면 ARIA 사용 금지.
- ARIA 가 필요한 패턴: Modal(`role="dialog"` + `aria-modal="true"` + focus trap), Toast(`role="status"` + `aria-live="polite"`), Tooltip(`aria-describedby`), Select(custom listbox 시 `role="listbox"` + `aria-activedescendant`).
- `aria-label` 은 *시각 라벨이 없는 경우에만*. 시각 라벨 있는 버튼에 중복 `aria-label` 금지 (screen reader 가 라벨을 2번 읽음).

**부정 예시** — `<div onClick={…}>` 에 `role="button"` + `tabIndex={0}` 직접 추가. Enter/Space 핸들링·disabled 상태·focus 관리 모두 직접 구현해야 함. *`<button type="button">` 사용으로 100% 해결.*

### 4.4 Milestone 2 인계

핵심 8개 컴포넌트는 axe-core 자동 점검 + 키보드 navigation 수동 점검을 *acceptance gate* 로 통과해야 한다 — 두 점검 모두 [PRD Success Metrics](../../../../.claude/prds/design-system-v1.prd.md) 의 측정 기준.

---

## 5. Refactoring UI — 시각 위계

**결정**: 위계는 weight/color 보다 **scale & whitespace** 로 먼저 표현한다. 출처: https://www.refactoringui.com

### 5.1 위계 우선순위 (적용 순서)

1. **Scale (크기)** — H1 = `--text-3xl`, H2 = `--text-2xl`, body = `--text-base`. 1.25~1.5× ratio 의 modular scale.
2. **Whitespace (여백)** — 중요한 요소는 *주변에 더 많은 빈 공간*. `--spacing-section` (clamp 2~4rem) 으로 섹션 호흡.
3. **Weight (굵기)** — title 600 / body 400 / caption 400 + `--color-text-muted`. 600 이상은 sparingly.
4. **Color contrast** — primary = `--color-text` / secondary = `--color-text-muted` / tertiary = `--color-text-subtle`. 색조 차이로 위계를 만들지 않는다 (색맹 트랩).

### 5.2 색상 system — 의미 단위

| 의미 | Token | 사용처 |
|---|---|---|
| Brand 강조 | `--color-accent` / `--color-accent-hover` / `--color-accent-soft` / `--color-accent-fg` | 파일 업로드/다운로드 등 *1차 행동* — 한 화면에 1~2개 |
| 성공 | `--color-success` | 업로드 완료 toast, checkbox check |
| 경고 | `--color-warning` | 용량 80% 초과 안내 |
| 위험 | `--color-danger` / `--color-danger-soft` | 삭제 확인 모달, 파괴적 행동 버튼 |
| 표면 | `--color-surface` / `-muted` / `-elevated` | 배경 계층(card·modal·toast 분리) |
| 본문 텍스트 | `--color-text` / `-muted` / `-subtle` | 위계 3단 (§5.1.4) |
| 구분선 | `--color-border` / `-strong` | input·card 외곽선 |

> `--color-accent-soft` 는 accent 색의 *희석 배경*(예: tag, badge, selected row) — 절대 본문 텍스트 색으로 사용 금지(contrast 부족).

### 5.3 Spacing scale

- vertical rhythm 의 단위는 `--spacing-section` (섹션 간), `--spacing-gutter` (블록 간), Tailwind 의 `space-{n}` (요소 간). 세 단위를 *섞지 말고*, 위계에 맞춰 한 단위만 사용.
- mobile 의 safe-area 는 `--spacing-safe-{top,bottom,left,right}` (notch·home indicator 대응). app-level layout 에서만 사용 — 개별 컴포넌트는 무관.

**부정 예시** — Card 내부 padding 을 `p-2` / `p-3` / `p-4` / `p-6` 4종을 한 페이지에 혼용. *시각 위계가 noise 로 보임.* `p-4` (= `1rem`) + `p-6` (= `1.5rem`) 2종으로 통일.

### 5.4 Milestone 2 인계

핵심 8개 컴포넌트의 default padding·gap·typography 는 §5.3 spacing scale + §5.1 위계 4단계만 사용 — 새 token 발명 금지.

---

## 6. TailwindCSS 4 utility-first + tokens.css

**결정**: 모든 시각 스타일은 (a) [tokens.css](../../../../services/web/src/shared/styles/tokens.css) 의 `@theme` 블록에 정의된 토큰을 (b) Tailwind 4 가 자동 노출하는 utility class 로 사용한다. *inline `style` 속성·hardcoded hex/rgb·새 토큰 발명 금지.* Tailwind `@theme` 동작: https://tailwindcss.com/docs/theme

### 6.1 token → utility class 자동 매핑

Tailwind 4 는 `--color-*` / `--text-*` / `--spacing-*` / `--radius-*` / `--motion-*` 을 *그대로 utility class 로 노출*한다 (`@theme inline` 키 이름이 곧 class 이름).

```css
/* tokens.css */
@theme {
  --color-accent: oklch(58% 0.18 255);
  --text-base: clamp(1rem, 0.96rem + 0.2vw, 1.0625rem);
  --radius-pill: 9999px;
}
```

```tsx
// 컴포넌트 — 토큰 이름 그대로 class 로
<button className="bg-accent text-accent-fg text-base rounded-pill">
  업로드
</button>
```

### 6.2 정식 token 표

[tokens.css](../../../../services/web/src/shared/styles/tokens.css) 의 모든 키만 사용한다. 새 토큰 발명 금지 — 필요 시 *tokens.css 에 먼저 추가하고* 컴포넌트에서 사용.

| 카테고리 | 키 prefix | 예 |
|---|---|---|
| Typography | `--font-sans`, `--text-{xs,sm,base,lg,xl,2xl,3xl}` | `text-base`, `text-2xl` |
| Color — surface | `--color-surface{,-muted,-elevated}` | `bg-surface`, `bg-surface-muted` |
| Color — text | `--color-text{,-muted,-subtle}` | `text-text`, `text-text-muted` |
| Color — border | `--color-border{,-strong}` | `border-border`, `border-border-strong` |
| Color — accent | `--color-accent{,-hover,-soft,-fg}` | `bg-accent`, `hover:bg-accent-hover` |
| Color — semantic | `--color-{success,warning,danger,danger-soft}` | `text-danger`, `bg-danger-soft` |
| Spacing — safe-area | `--spacing-safe-{top,bottom,left,right}` | `pt-safe-top`, `pb-safe-bottom` |
| Spacing — rhythm | `--spacing-{section,gutter}` | `py-section`, `gap-gutter` |
| Radius | `--radius-{xs,sm,md,lg,xl,pill}` | `rounded-md`, `rounded-pill` |
| Motion duration | `--motion-duration-{fast,normal,slow}` | `duration-fast`, `duration-normal` |
| Motion ease | `--motion-ease-{out,in-out,spring}` | `ease-out`, `ease-spring` |

> `zinc-*` (Tailwind 기본 팔레트) 는 *catalyst 잔존 사용처에서만* 허용 — 신규 컴포넌트는 위 token utility 만. catalyst 제거(§8) 시 일괄 교체 예정.

> Dark mode 분기는 위 token utility 가 *자동 적용*한다 — tokens.css 의 `.dark` selector 가 surface·text·border·accent·semantic 값을 override. 컴포넌트는 `dark:` variant 를 *수동 추가하지 않고* `bg-surface text-text` 만 쓰면 light/dark 양쪽에서 올바른 톤이 나온다. 자세한 정책은 §7.1 "Dark mode" 행 참조.

### 6.3 `cn()` 유틸 — 조건부 class

조건부·variant class 조합은 항상 [shared/lib/utils/cn.ts](../../../../services/web/src/shared/lib/utils/cn.ts) 의 `cn()` 유틸 경유. [coding-style.md](./coding-style.md) 의 "클래스 조합" 규칙을 따른다.

```tsx
// ✅
className={cn(
  'rounded-md text-base',
  variant === 'primary' && 'bg-accent text-accent-fg',
  variant === 'ghost' && 'bg-transparent text-text',
  disabled && 'opacity-50 pointer-events-none',
)}

// ❌ template literal + ternary 중첩
className={`rounded-md ${variant === 'primary' ? 'bg-accent ...' : ...}`}
```

### 6.4 금지 사항

- **inline `style` 속성** — Tailwind utility 또는 token 으로 표현 가능한 모든 경우 금지. 동적 값이 필요하면 CSS custom property 를 `style` 로 주입 후 utility 에서 `var(--x)` 참조.
- **hardcoded hex / rgb / oklch** — `bg-[#3b82f6]` 같은 arbitrary value 도 금지. 필요한 색은 tokens.css 에 의미 이름으로 추가.
- **catalyst 의 색·dimension 답습** — Milestone 2 의 headless 마이그레이션 시 catalyst 의 hex 값/`px` 값을 그대로 옮기지 않는다. token 으로 재해석.

### 6.5 Milestone 2 인계

핵심 8개 컴포넌트는 §6.2 표의 token utility 만 사용한다 — *새 utility class 가 필요하면 token 으로 환원할 수 있는지 먼저 검증* 하고, 환원 불가일 때만 tokens.css 갱신 PR 을 별도로 낸다.

---

## 7. Trend curation — 허용 / v1.1 검토 / 금지

**결정**: trend 채택은 본 가이드의 §7 표가 권위 source. 표에 없는 새 trend 는 *plan 단계에서* 본 표에 추가 검토를 거친 뒤에만 채택. 일반 anti-template 정책은 [design-quality.md](./design-quality.md) "Anti-Template Policy" 가 1차 출처이고 — 본 §7 은 그 위에서 *mobile-first 맥락의 trend 만* 다룬다.

### 7.1 v1.0 허용 trend

| Trend | 적용 위치 | 근거 |
|---|---|---|
| Bento layout | drive 메인 페이지의 "최근 파일 / 공유 / 휴지통" 요약 카드 | 모바일에서 *cards-in-cards* 가 정보 위계 명확. [design-quality.md "Required Qualities" 7](./design-quality.md) |
| 의미 있는 motion (220ms 이하) | modal/toast 진입, list 정렬, FAB | §2.3 motion token 안에서만. *장식용 motion 금지* |
| Editorial typography (scale contrast) | drive 빈 상태 / 공유 받기 onboarding | §5.1 위계 우선순위 |
| Soft surface + subtle shadow (Material elevation level 1~2) | card·modal·bottom sheet | https://m3.material.io/styles/elevation/overview |
| Dark mode | 모든 표면 — tokens.css 의 `.dark` selector override 가 surface·text·border·accent·semantic 값을 분기 | system theme 추종(prefers-color-scheme) + 수동 토글 모두 지원. light/dark contrast 4.5:1 (§4.1) 통과 token 페어만 채택. **금지 trend §7.3 의 "Dark mode 강제 default" 와 구별** — 본 행은 *선택 가능한* dark, §7.3 은 *강제 default* |

### 7.2 v1.1 이후 검토

| Trend | 미루는 이유 |
|---|---|
| Dark luxury / 큰 typography hero | drive 같은 *기능 앱*은 hero 가 약함. 마케팅 페이지 신설 시 검토. |
| 3D / canvas-based 시각화 | Capacitor WebView 의 GPU 부담 검증 필요. v1.1 에서 *기기 표본 측정* 후. |
| Glassmorphism (조건부 — 절제된 사용) | §7.3 의 금지 사유와 trade-off. v1.1 에서 *반드시 fallback 디자인 함께* 검토. |

### 7.3 v1.0 금지 trend (negative examples)

| Trend | 금지 사유 |
|---|---|
| **Bootstrap-style 균일 디자인** | 정체성 부재 — drive 가 일반 SaaS dashboard 와 구별되지 않음 (PRD Evidence §1 — catalyst 잔재가 정확히 이 모양) |
| **Glassmorphism (`backdrop-filter: blur`)** | (a) Android WebView 의 GPU 부담 (b) 텍스트 가독성·대비 4.5:1 trade-off (§4.1) (c) 저사양 기기 fallback 부재 — v1.1 에서 fallback 함께 검토 |
| **Neumorphism (soft UI)** | 접근성 contrast 3:1 만족 불가 (§4.1) — 거의 모든 인터랙티브 요소가 위반 |
| **Dark mode 강제 default** | 시스템 prefers-color-scheme 무시. 사용자 선택권 침해 + 광량 환경에서 가독성 악화 |
| **장식용 motion (loop animation, parallax)** | mobile 의 battery·CPU 부담 + prefers-reduced-motion 미고려 시 a11y 위반 |
| **carousel 으로 1차 콘텐츠 노출** | mobile 손가락 도달성·인지부담 모두 나쁨. tab 또는 list 로 대체 |

> §7 표에 *없는* 새 trend 는 plan 단계에서 본 가이드 §7 PR 로 먼저 등재 — "써보고 결정" 하지 않는다.

### 7.4 Milestone 2 인계

핵심 8개 컴포넌트는 §7.1 의 elevation·motion·typography 만 *시각 어휘*로 사용한다. §7.3 금지 trend 의 시각 어휘가 컴포넌트 default 에 등장하면 PR 리뷰 차단.

---

## 8. catalyst 임시 정책 + Milestone 2/3 인계

**결정**: `services/web/src/shared/ui/catalyst/` 는 v1.0 출시 전 headless 컴포넌트로 교체될 *임시 마이그레이션 대상*이다. **신규 코드에서 catalyst import 금지** — 자동 차단은 [PRD design-system-v1 Milestone 3](../../../../.claude/prds/design-system-v1.prd.md) 의 lint rule 로 도입. 그 전까지는 PR 리뷰의 `git grep "from '@/shared/ui/catalyst/'"` 수동 점검으로 통제.

### 8.1 catalyst 의 위치

- 위치: `services/web/src/shared/ui/catalyst/**`
- 정체: Tailwind UI / catalyst kit 의 *예시* 컴포넌트. 빠른 스파이크용으로 임시 채용.
- 채택 시점: PRD A `mobile-app-feel` (v1.0 모바일 기본기) 이전 — 그래서 시각 톤이 일반 SaaS dashboard 톤.
- 본 가이드의 §2~§7 어느 항목과도 *명시적 일치 보장이 없다*.

### 8.2 신규 코드에서의 규칙

| 상황 | 허용 여부 | 대안 |
|---|---|---|
| 신규 컴포넌트가 catalyst import | ❌ 금지 | `shared/ui/{component}/` headless 컴포넌트를 신설 or 사용 |
| 기존 catalyst 사용처 *유지*만 (시각 변경 없음) | ⚠️ 허용 — 단 Milestone 2 마이그레이션 대상 식별을 위해 *주석으로 표기* | `// TODO(design-system-v1): catalyst → headless 마이그레이션` |
| 기존 catalyst 컴포넌트 *직접 수정* | ❌ 금지 (catalyst 원본 보존) | 래퍼·확장 컴포넌트는 *작성하지 않는다*. headless 신설로 대체 |
| catalyst 의 hex 값/`px` 값을 신규 컴포넌트가 답습 | ❌ 금지 | §6.2 의 token utility 로 재해석 |

### 8.3 Milestone 2 — 핵심 8개 headless 마이그레이션

| 컴포넌트 | catalyst 경로 | headless 위치 (예정) | §2.2 anatomy |
|---|---|---|---|
| Button | `shared/ui/catalyst/button.tsx` | `shared/ui/button/` | Material Buttons |
| Input (Text Field) | `shared/ui/catalyst/input.tsx` | `shared/ui/input/` | Material Text Fields |
| Modal (Dialog) | `shared/ui/catalyst/dialog.tsx` | `shared/ui/modal/` | Material Dialog + Bottom Sheet 분기 |
| Toast | `shared/ui/catalyst/toast.tsx` | `shared/ui/toast/` | Material Snackbar |
| Tooltip | `shared/ui/catalyst/tooltip.tsx` | `shared/ui/tooltip/` | Material Tooltip |
| Select | `shared/ui/catalyst/select.tsx` | `shared/ui/select/` | Material Menu (single-select) |
| Checkbox | `shared/ui/catalyst/checkbox.tsx` | `shared/ui/checkbox/` | Material Checkbox |
| Radio | `shared/ui/catalyst/radio.tsx` | `shared/ui/radio/` | Material Radio |

> headless 라이브러리 채택 vs 직접 구현 결정은 [PRD Open Questions](../../../../.claude/prds/design-system-v1.prd.md) 에서 Milestone 2 plan 단계 결정. 본 가이드는 채택 라이브러리와 무관하게 anatomy·token·a11y 의 *고정 기준*만 제공.

### 8.4 Milestone 3 — 자동 차단 + 표면화

- `shared/ui/catalyst/README.md` 신설 — "v1.X 제거 예정. 신규 import 금지" 명시.
- lint rule (ESLint `no-restricted-imports` or grep-based pre-commit) — 신규 catalyst import 차단.
- 본 가이드 §8.2 의 "신규 코드에서 catalyst import 금지" 가 lint rule 의 권위 source.

### 8.5 catalyst 완전 제거 시점

- v1.0 출시 = Milestone 2 완료(핵심 8개) 시점. **catalyst 디렉토리 자체 제거는 v1.X (Milestone 2 외 사용처도 마이그레이션 완료 후)**.
- v1.0 시점의 잔존 catalyst 사용처 (DataTable / ComboBox / DatePicker / NavBar 등) 는 [PRD Out of scope](../../../../.claude/prds/design-system-v1.prd.md) — v1.1 이후 별도 PRD.

---

## 종료 체크리스트

새 컴포넌트·페이지·widget 을 만들기 전 — 그리고 PR 을 올리기 전 — 본 체크리스트 통과.

- [ ] **Touch target ≥ 48dp** (§2.1) — 24px 아이콘은 padding 으로 hit-area 보강.
- [ ] **Component anatomy** Material 출처(§2.2) 와 어긋나지 않음.
- [ ] **Motion** 은 §2.3 token 만 사용, layout-bound property animate 없음.
- [ ] **HIG 보편 원칙**(가독성·직접 조작·모달의 책임감) 점검 — Material 과 충돌 시 Material.
- [ ] **WCAG 2.2 AA** §4.1 표 8개 criterion 통과 (axe-core + 키보드 수동).
- [ ] **focus-visible** 스타일 존재, `:focus` 단독 사용 없음.
- [ ] **위계는 scale & whitespace 우선** (§5.1), color 단독으로 위계 표현 없음.
- [ ] **tokens.css 의 utility class 만** 사용 (§6.2), 새 토큰 발명 없음.
- [ ] **inline style·hardcoded color** 없음, `cn()` 유틸 사용.
- [ ] **§7.3 금지 trend** 의 시각 어휘가 default 에 등장하지 않음.
- [ ] **신규 catalyst import 0건** (§8.2) — 기존 사용처는 TODO 주석 + Milestone 2 인계.

# Plan: design-system-v1 — 핵심 8개 컴포넌트 headless 마이그레이션

**Source PRD**: [.claude/prds/design-system-v1.prd.md](../prds/design-system-v1.prd.md)
**Selected Milestone**: #2 핵심 8개 컴포넌트 headless 마이그레이션
**Complexity**: Large
**Worktree**: `.worktrees/design-system-v1-headless/` · branch `feat/design-system-v1-headless`

## Summary

catalyst 의 Button/Input/Dialog/Checkbox(사용처 있음 4개) + Toast/Tooltip/Select/Radio(사용처 0건 신설 4개) 를 `@headlessui/react` 기반 headless 컴포넌트로 `services/web/src/shared/ui/{component}/` 에 신설한다. tokens.css utility + WCAG 2.2 AA + Material 48dp 만 사용하며, `@/shared/ui` barrel 의 re-export 를 컴포넌트 단위로 incremental 하게 교체해 사용처 cascade 컴파일 에러를 즉시 catch 한다.

## Pre-decisions (PRD Open Questions 답)

| Open Question | 결정 | 근거 |
|---|---|---|
| headless lib 채택 vs 100% 직접 구현 | **`@headlessui/react@2.2.9` 채택** | `services/web/package.json:33` 에 이미 의존성 존재 + catalyst 자체도 Headless UI 기반. 직접 구현은 PRD Risk "ARIA 정확성 결함" 직접 적중. v2.2.9 가 Button / Dialog / Listbox(Select) / Combobox / Checkbox / RadioGroup / Field / Description 등 핵심 primitive 전부 제공. Toast/Tooltip 만 자체 구현(Headless v2 미제공) |
| mobile-ui-guide.md 구조 (단일 vs 분할) | **단일 파일 유지** | Milestone 1 이 이미 단일 파일로 완성됨. 본 plan 범위 밖 |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 슬라이스 구조 | [catalyst/button/index.ts](../../services/web/src/shared/ui/catalyst/button/index.ts) + [ui/Button.tsx](../../services/web/src/shared/ui/catalyst/button/ui/Button.tsx) | `index.ts` = `export * from './ui/Component'`, 컴포넌트 본체는 `ui/` 안에 |
| Headless wrapper | `catalyst/button/ui/Button.tsx` 의 `<Headless.Button>` + `data-hover`/`data-focus`/`data-active`/`data-disabled` | Headless UI v2 의 `data-*` attribute selector 패턴 그대로 차용 |
| `cn()` 사용 | [shared/lib/utils/cn.ts](../../services/web/src/shared/lib/utils/cn.ts) (clsx + tailwind-merge) | 조건부 class 조합은 `cn()` 경유, 인라인 `style` 금지 ([services/web/CLAUDE.md "컴포넌트 컨벤션"](../../services/web/CLAUDE.md)) |
| variant 표현 | `package.json:40` 의 `cva` (이미 의존성) | `cva` matrix 로 variant × tone × size 조합 빌드 |
| Props interface | [ecc/typescript/coding-style.md "React Props"](../rules/ecc/typescript/coding-style.md) | `interface XxxProps`, 파일 상단, callback prop 명시 타입, `React.FC` 미사용 |
| 함수 선언 | [services/web/CLAUDE.md "함수 선언 컨벤션"](../../services/web/CLAUDE.md) | top-level `function` 선언, 내부는 arrow function |
| 테스트 위치 | [services/web/CLAUDE.md "테스트 파일 위치"](../../services/web/CLAUDE.md) | `ui/Button.tsx` 옆에 `ui/Button.test.tsx`. vitest + @testing-library/react |
| 토큰 utility | [tokens.css](../../services/web/src/shared/styles/tokens.css) + [mobile-ui-guide §6.2](../rules/ecc/web/mobile-ui-guide.md) | `bg-accent`, `text-text`, `rounded-md`, `duration-fast` — utility 만, hex/zinc 금지 |
| Dark mode | `tokens.css` 의 `.dark` selector override (`L100-134`) | `dark:` variant 수동 추가 *불필요* — `bg-surface text-text` 만 쓰면 자동 분기 |
| FSD 슬라이스 export | [services/web/CLAUDE.md "FSD 레이어 의존 규칙"](../../services/web/CLAUDE.md) | 각 슬라이스 `index.ts` 가 단일 진입점. 내부 경로 직접 import 금지 |

## Files to Change

### CREATE — 8 슬라이스 (각 4 파일)

| Slice | Files |
|---|---|
| `shared/ui/button/` | `index.ts`, `ui/Button.tsx`, `ui/Button.test.tsx`, `ui/buttonStyles.ts` |
| `shared/ui/input/` | `index.ts`, `ui/Input.tsx`, `ui/Input.test.tsx`, `ui/inputStyles.ts` |
| `shared/ui/modal/` | `index.ts`, `ui/Modal.tsx`, `ui/Modal.test.tsx`, `ui/modalStyles.ts` |
| `shared/ui/toast/` | `index.ts`, `ui/Toast.tsx`, `ui/ToastProvider.tsx`, `ui/useToast.ts`, `ui/Toast.test.tsx` |
| `shared/ui/tooltip/` | `index.ts`, `ui/Tooltip.tsx`, `ui/Tooltip.test.tsx`, `ui/tooltipStyles.ts` |
| `shared/ui/select/` | `index.ts`, `ui/Select.tsx`, `ui/Select.test.tsx`, `ui/selectStyles.ts` |
| `shared/ui/checkbox/` | `index.ts`, `ui/Checkbox.tsx`, `ui/Checkbox.test.tsx`, `ui/checkboxStyles.ts` |
| `shared/ui/radio/` | `index.ts`, `ui/Radio.tsx`, `ui/Radio.test.tsx`, `ui/radioStyles.ts` |

### UPDATE — barrel & catalyst index

| File | Action | Why |
|---|---|---|
| `services/web/src/shared/ui/index.ts` | UPDATE | catalyst-only `export * from './catalyst'` 단일 라인 → 신규 8 슬라이스 + 잔존 catalyst 분할 re-export. **Task 단위로 incremental update** |
| `services/web/src/shared/ui/catalyst/index.ts` | UPDATE | 6개 라인 제거: `button`, `input`, `dialog`, `checkbox`, `radio`, `select` (Toast/Tooltip 은 catalyst 에 원래 없음). 잔존 catalyst slice (alert, auth-layout, avatar, badge, combobox, description-list, divider, dropdown, fieldset, heading, link, listbox, navbar, pagination, sidebar, sidebar-layout, stacked-layout, switch, table, text, textarea) 는 유지 — PRD out-of-scope |

### UPDATE — 사용처 호출부 (Task 별 grep 후 결정)

| File | Slice 영향 | 변경 종류 |
|---|---|---|
| `widgets/sidebar-layout/ui/SidebarLayout.tsx` | (none — `SidebarLayout` 자체는 v1.1) | unchanged |
| `widgets/sidebar/ui/Sidebar.tsx` | Heading/Sidebar (catalyst) | unchanged |
| `widgets/navbar/ui/Navbar.tsx` | Navbar (catalyst) | unchanged |
| `widgets/file-list/ui/FileList.tsx` | Button | 호출부 prop 매핑 |
| `widgets/auth-layout/ui/AuthLayout.tsx` | AuthLayout (catalyst) | unchanged |
| `features/file-upload/ui/UploadButton.tsx` | Button | 호출부 prop 매핑 |
| `features/file-download/ui/DownloadButton.tsx` | Button + Alert(catalyst 유지) | Button 호출부만 변경 |
| `features/file-preview/ui/FilePreviewDialog.tsx` | Button + Dialog→Modal | 호출부 + import 이름 변경 |
| `features/folder-create/ui/NewFolderButton.tsx` | Button + Dialog→Modal + Input | 호출부 + import 이름 변경 |
| `features/folder-delete/ui/DeleteFolderMenuItem.tsx` | Button + Alert(catalyst 유지) | Button 호출부만 |
| `features/folder-move/ui/MoveFolderMenuItem.tsx` | Button + Dialog→Modal | 호출부 + import 이름 변경 |
| `features/folder-rename/ui/RenameFolderMenuItem.tsx` | Button + Dialog→Modal + Input | 호출부 + import 이름 변경 |
| `features/backup-code/ui/BackupCodeSection.tsx` | Button + Heading(catalyst 유지) | Button 호출부만 |
| `features/trusted-device/ui/TrustThisDeviceCheckbox.tsx` | Checkbox + Label(catalyst 유지) | Checkbox 호출부 |
| `features/trusted-device/ui/TrustedDeviceSection.tsx` | Heading(catalyst 유지) | unchanged |
| `features/login-by-credentials/ui/LoginForm.tsx` | Button + Input + Field/Label(catalyst 유지) | Button/Input 호출부 |
| `features/login-by-2fa/ui/TwoFactorWaiting.tsx` | Button + Heading(catalyst 유지) | Button 호출부 |
| `features/login-by-2fa/ui/TwoFactorBackupEntry.tsx` | Button + Input + Field/Fieldset/Label(catalyst 유지) | Button/Input 호출부 |
| `features/login-by-2fa/ui/TwoFactorApprovalPage.tsx` | Heading(catalyst 유지) | unchanged |
| `pages/login/ui/LoginPage.tsx` | Heading(catalyst 유지) | unchanged |
| `pages/register/ui/RegisterPage.tsx` | Heading(catalyst 유지) | unchanged |
| `pages/register/ui/BackupCodeIssuePage.tsx` | Button + Heading(catalyst 유지) | Button 호출부 |

## Migration Strategy — barrel re-export incremental

`@/shared/ui` 가 단일 진입점이라는 점을 활용해 *컴포넌트 단위 교체*. 각 Task 마지막에 barrel 갱신 → 즉시 build → 컴파일 에러로 누락된 사용처를 catch.

```typescript
// services/web/src/shared/ui/index.ts — Task 1 완료 후 상태 (예)
export * from './button';                             // ← 새로 export (catalyst Button 덮어쓰기)
export {
  Alert, AlertActions, AlertDescription, AlertTitle,  // PRD scope 외 — catalyst 유지
  AuthLayout, Avatar, Badge,
  Checkbox, CheckboxField,                            // ← Task 4 전까지 catalyst 유지
  Combobox,
  Dialog, DialogActions, DialogBody, DialogTitle,     // ← Task 3 전까지 catalyst 유지
  Field, FieldGroup, Fieldset, Heading,
  Input,                                              // ← Task 2 전까지 catalyst 유지
  Label, Link, Listbox,
  Navbar, NavbarItem, /* … */
  Radio,                                              // ← Task 5 전까지 catalyst 유지
  Select,                                             // ← Task 6 전까지 catalyst 유지
  Sidebar, SidebarLayout, StackedLayout, Switch, Table, Text, Textarea,
} from './catalyst';
```

> 마지막 Task 9 에서 catalyst barrel 자체를 줄여 위 명시적 re-export 와 일치시킴.

## Tasks

### Task 1 — Button (사용처 13)

**Action**:

1. `shared/ui/button/{index.ts, ui/Button.tsx, ui/Button.test.tsx, ui/buttonStyles.ts}` 생성.
2. Props API:
   ```typescript
   interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
     variant?: 'filled' | 'tonal' | 'outlined' | 'text';   // default 'filled'
     tone?: 'accent' | 'danger' | 'neutral';                // default 'accent'
     size?: 'sm' | 'md';                                    // default 'md' (= 48dp hit-area)
     href?: string;                                          // 있으면 <Link> 래핑
     leadingIcon?: React.ReactNode;
     trailingIcon?: React.ReactNode;
     loading?: boolean;
   }
   ```
3. `buttonStyles.ts` 에서 cva matrix: `variant(filled|tonal|outlined|text) × tone(accent|danger|neutral) × size(sm|md)`. 모든 색은 `bg-accent`, `bg-danger`, `bg-surface-muted` 등 의미 token utility 만 사용 — zinc/blue/red hex 0건.
4. **48dp hit-area**: `size='md'` 기본 `min-h-12 px-4 text-base` (= 48px). `size='sm'` 은 `min-h-9 px-3` (=36px) — *inline + 충분한 spacing* 이 있을 때만 ([mobile-ui-guide §2.1 예외](../rules/ecc/web/mobile-ui-guide.md)).
5. `<Headless.Button>` + focus ring: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2` ([mobile-ui-guide §4.2](../rules/ecc/web/mobile-ui-guide.md)).
6. `href` 분기: 있으면 react-router `<Link>` 로 폴리모픽 — catalyst 동일 패턴 유지.
7. `loading=true` 시 `aria-busy="true"` + 스피너 슬롯, 클릭 차단.
8. **테스트**: render(default/each variant/each tone), hit-area >=48px, focus-visible ring, disabled non-clickable, href→link, leading/trailing icon slot, loading aria-busy + click suppressed.
9. **barrel 갱신**: `shared/ui/index.ts` 에서 `export * from './button'` 추가 + catalyst re-export 에서 `Button` 분리.
10. **사용처 13개 마이그레이션** (catalyst `<Button color='dark/zinc' plain outline>` → 신규 API):
    - `git grep -n "<Button" services/web/src` 로 호출부 전수 추출.
    - 매핑 표 작성 후 Edit 일괄:
      | catalyst | 신규 |
      |---|---|
      | (기본) | `variant='filled' tone='accent'` |
      | `color='dark/zinc'` / `color='zinc'` | `variant='filled' tone='neutral'` |
      | `color='red'` | `variant='filled' tone='danger'` |
      | `plain` | `variant='text' tone='neutral'` |
      | `outline` | `variant='outlined' tone='neutral'` |
    - 실제 사용처 호출부를 grep 으로 확인하면서 위 매핑이 맞는지 케이스별 검증.

**Validate**:

```bash
cd services/web
npm run lint
npm run build
npm test -- shared/ui/button
git grep -E "from '@/shared/ui/catalyst/button'" || echo "OK: no catalyst Button leftover"
```

→ build/test pass + catalyst Button 직접 import 0건.

### Task 2 — Input (사용처 4)

**Action**:

1. `shared/ui/input/` 슬라이스. Props:
   ```typescript
   interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
     tone?: 'neutral' | 'danger';            // invalid state
     size?: 'sm' | 'md';                      // default 'md'
     leadingIcon?: React.ReactNode;
     trailingIcon?: React.ReactNode;
     describedById?: string;                  // a11y — error/helper text id
   }
   ```
2. Material Text Field anatomy (filled variant): leading icon · input · trailing icon · clear/show-password slot.
3. `<Headless.Input>` 사용. `aria-invalid` 분기.
4. **48dp hit-area**: `size='md'` `min-h-12 px-4`. focus 시 `ring-2 ring-accent`.
5. **테스트**: typing, change handler, focus ring, `tone='danger'` 시 `aria-invalid="true"` + 색 분기, disabled, password type 시 show/hide toggle (선택).
6. **barrel 갱신** + **사용처 4개** (LoginForm, TwoFactorBackupEntry, RenameFolderMenuItem, NewFolderButton) 호출부 검사:
   - 대부분 prop 변경 없이 통과 가능. `invalid` 또는 catalyst 의 size prop 사용 시만 수정.

**Validate**: `npm run build && npm test -- shared/ui/input`

### Task 3 — Modal (Dialog → Modal 이름 변경) (사용처 4)

**Action**:

1. `shared/ui/modal/` 슬라이스. Props:
   ```typescript
   interface ModalProps {
     open: boolean;
     onClose: () => void;
     size?: 'sm' | 'md' | 'lg';
     dismissible?: boolean;                   // backdrop tap / esc 로 닫기 허용 (default true)
   }
   ```
2. **mobile/desktop 분기** ([mobile-ui-guide §2.2](../rules/ecc/web/mobile-ui-guide.md)):
   - `window.matchMedia('(max-width: 767px)')` → BottomSheet (slide-up from bottom)
   - 그 외 → centered Dialog
3. `<Headless.Dialog>` + focus trap + `aria-modal="true"`.
4. **Compound 슬롯**: `<Modal.Header>`, `<Modal.Body>`, `<Modal.Footer>` ([mobile-ui-guide §7 패턴 + ecc/web/patterns.md "Compound Components"](../rules/ecc/web/patterns.md)). 즉 catalyst 의 `DialogTitle`/`DialogBody`/`DialogActions` 1:1 대응.
5. **Motion**: enter `--motion-duration-normal --motion-ease-out`, exit `--motion-duration-fast`.
6. `dismissible=false` 시 backdrop click 무시 + `Esc` 무시 (`onClose` 호출 안 함).
7. **테스트**: open/close, focus trap (Tab 으로 모달 밖 탈출 불가), Esc 닫기, backdrop click 닫기, `dismissible=false` 무시, mobile vs desktop variant 분기 (vitest matchMedia mock), `aria-modal="true"`.
8. **barrel 갱신**: `Modal` + 슬롯 export. catalyst `Dialog/DialogActions/DialogBody/DialogTitle` 제거.
9. **사용처 4개** (`FilePreviewDialog`, `RenameFolderMenuItem`, `MoveFolderMenuItem`, `NewFolderButton`) import 와 JSX 교체:
   - `import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/shared/ui';` → `import { Modal } from '@/shared/ui';`
   - `<Dialog><DialogTitle>… → <Modal><Modal.Header>…`

**Validate**: `npm run build && npm test -- shared/ui/modal`

### Task 4 — Checkbox (사용처 1)

**Action**:

1. `shared/ui/checkbox/` 슬라이스. Props:
   ```typescript
   interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
     checked: boolean;
     onChange: (checked: boolean) => void;    // catalyst 의 (e: ChangeEvent) 대신 boolean 으로 — DX 개선
     tone?: 'neutral' | 'danger';
     describedById?: string;
   }
   ```
2. `<Headless.Checkbox>` 사용. ARIA `role="checkbox"`, `aria-checked`, `aria-disabled` 자동.
3. **48dp hit-area**: visible box 는 16~20px 이지만 클릭 영역은 `min-h-12 min-w-12` 의 transparent padding.
4. `CheckboxField` wrapper 컴포넌트: label + helper text + checkbox 콤보 — catalyst CheckboxField 와 동일 API 로 사용처 호환 보장.
5. **테스트**: toggle (click & keyboard Space), label association (clicking label toggles), focus ring, disabled.
6. **barrel 갱신** + 사용처 1개 (`TrustThisDeviceCheckbox`) onChange 시그니처 변경.

**Validate**: `npm run build && npm test -- shared/ui/checkbox`

### Task 5 — Radio (사용처 0)

**Action**:

1. `shared/ui/radio/` 슬라이스. Compound:
   ```typescript
   <RadioGroup value={x} onChange={setX} label="...">
     <Radio value="a">옵션 A</Radio>
     <Radio value="b">옵션 B</Radio>
   </RadioGroup>
   ```
2. `<Headless.RadioGroup>` + `<Headless.Radio>`. ARIA `role="radiogroup"` 자동.
3. **48dp hit-area** 동일 처리.
4. **테스트**: arrow key navigation (Up/Down/Left/Right), single-select 보장 (한 번에 하나만), focus ring, label association, disabled radio skip.
5. **barrel 갱신**. 사용처 없으므로 호출부 변경 0.

**Validate**: `npm run build && npm test -- shared/ui/radio`

### Task 6 — Select (사용처 0)

**Action**:

1. `shared/ui/select/` 슬라이스. **single-select 만** (multi-select 는 v1.1 — PRD Out of scope 명시).
   ```typescript
   <Select value={x} onChange={setX} label="...">
     <Select.Option value="a">A</Select.Option>
     <Select.Option value="b">B</Select.Option>
   </Select>
   ```
2. `<Headless.Listbox>` 사용 (Material Menu anatomy).
3. ARIA: `role="listbox"`, `aria-activedescendant`.
4. **테스트**: open/close (click & keyboard Enter/Space), arrow key navigation, type-ahead (head char match), single-select, escape close.
5. **barrel 갱신**. 사용처 없음.

**Validate**: `npm run build && npm test -- shared/ui/select`

### Task 7 — Toast (사용처 0)

**Action**:

1. `shared/ui/toast/` 슬라이스. Material Snackbar anatomy.
2. **API**:
   ```typescript
   <ToastProvider>{children}</ToastProvider>
   const { show } = useToast();
   show({ message: '...', tone: 'success' | 'danger' | 'neutral', action?: { label, onClick }, duration?: 'short' | 'long' });
   ```
3. Queue 관리 — 동시 표시 최대 1, 추가는 큐잉.
4. **Duration**: `short = 4000ms`, `long = 10000ms` ([mobile-ui-guide §2.2](../rules/ecc/web/mobile-ui-guide.md)).
5. **ARIA**: `role="status"` + `aria-live="polite"` (성공/중립), `aria-live="assertive"` (danger).
6. **action 1개 한도** — 가이드 명시.
7. `app/` 의 Provider 트리에 `<ToastProvider>` 마운트.
8. **테스트**: queue 동작 (3개 enqueue → 순차 표시), duration 후 자동 dismiss, action click → onClick 발화 + dismiss, danger tone `aria-live="assertive"`, focus 이동 없음.

**Validate**: `npm run build && npm test -- shared/ui/toast`

### Task 8 — Tooltip (사용처 0)

**Action**:

1. `shared/ui/tooltip/` 슬라이스.
   ```typescript
   <Tooltip content="설명">
     <Button>호버 대상</Button>
   </Tooltip>
   ```
2. Headless UI v2 에 Tooltip primitive 없음 → `<Headless.Popover>` 또는 자체 portal + state machine. **결정**: 자체 구현 (Popover 는 click-trigger 가 기본이라 hover-trigger 와 의미 충돌). useFloating 류 외부 lib 채택은 회피 — 단순 fixed positioning.
3. **Delay**: hover 진입 500ms, focus 진입 즉시. Leave 시 즉시 dismiss.
4. **ARIA**: trigger 에 `aria-describedby={tooltipId}` 자동 wiring.
5. **Mobile (touch)**: hover 가 의미 없으므로 — touch 시 *표시 안 함* + 컨텐츠를 별도 `aria-label`/`aria-describedby` 로 보조기술 노출 필수. 가이드 cross-ref 주석.
6. **테스트**: show on hover (after 500ms), show on focus (immediate), hide on blur/leave, Esc 닫기, `aria-describedby` 자동 wiring.

**Validate**: `npm run build && npm test -- shared/ui/tooltip`

### Task 9 — `@/shared/ui` 전수 검증 + catalyst cleanup

**Action**:

1. `services/web/src/shared/ui/index.ts` 를 *명시적 named re-export* 로 정리 — 어떤 컴포넌트가 catalyst 잔존, 어떤 게 신규 headless 인지 한눈에 보이게.
2. `services/web/src/shared/ui/catalyst/index.ts` 에서 6개 라인 제거:
   ```diff
   - export * from './button';
   - export * from './checkbox';
   - export * from './dialog';
   - export * from './input';
   - export * from './radio';
   - export * from './select';
   ```
3. `npm run build` → 모든 사용처가 새 컴포넌트로 컴파일 통과 확인. 통과하지 못한 사용처는 Task 1-8 의 호출부 grep 누락 → 보완.
4. `git grep` 검증:
   ```bash
   git grep -E "from '@/shared/ui/catalyst/(button|input|dialog|checkbox|radio|select)'" -- 'services/web/src/**'
   # → 0건
   ```
5. `npm run cap:sync` → Capacitor Android WebView 호환성 확인 (build 산출물의 토큰 utility 정상 컴파일).
6. PRD `Delivery Milestones` 표의 #2 행 update: `pending` → `done`, Plan 셀에 본 plan path 기록.

**Validate**:

```bash
cd services/web
npm run lint
npm run build
npm test
npm run cap:sync
git grep -E "from '@/shared/ui/catalyst/(button|input|dialog|checkbox|radio|select)'" -- 'services/web/src/**' && exit 1 || echo "OK: no catalyst leftover"
```

## Validation (전체)

```bash
# 모든 task 후 통합 검증
cd services/web
npm run lint                                              # ESLint
npm run build                                             # tsc -b + vite build
npm test                                                  # vitest run — 8 슬라이스 단위 테스트 전부
npm run cap:sync                                          # Capacitor Android 호환성

# Success Metrics 검증
git grep -E "from '@/shared/ui/catalyst/(button|input|dialog|checkbox|radio|select)'" -- 'services/web/src/**'  # → 0건 (Metric: 핵심 8개 의존 제거)
wc -l ../../.claude/rules/ecc/web/mobile-ui-guide.md     # ≤ 800 (이미 통과, 변경 없음)
```

a11y 검증은 각 Task 의 단위 테스트에 `@testing-library/react` 기반 ARIA assertion 인라인 — 별도 axe-core integration 은 v1.1 (PRD out-of-scope: "Storybook / 문서 사이트").

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| catalyst Button 의 `color`/`plain`/`outline` prop 매핑 표 누락 → 13개 사용처 중 일부 컴파일 에러 | High | Medium | Task 1 후반에 `git grep -nE "<Button[^>]*(color|plain|outline)" services/web/src` 로 전수 추출 → 매핑 표 → Edit 일괄. 누락은 `npm run build` 가 즉시 catch |
| `Dialog → Modal` 이름 변경 + 슬롯 이름 변경(DialogActions/Body/Title → Modal.Header/Body/Footer) — 사용처 4개 누락 시 런타임 import error | High | High | Task 3 의 barrel 교체 직후 `npm run build` 통과까지 반복. catalyst 의 `Dialog*` export 라인은 통과 확인 후에만 제거 |
| mobile vs desktop Modal 분기에서 BottomSheet 의 drag-to-dismiss gesture 가 Capacitor Android WebView 의 system back gesture 와 충돌 | Medium | Medium | v1.0 BottomSheet 은 **drag X, backdrop tap + Esc 만**. drag gesture 는 v1.1 |
| Heading/Field/Label/Alert/Fieldset (PRD 핵심 8개 외, 사용처 많음) 도 `export * from './catalyst'` 일괄 제거 시 함께 깨짐 | High | High | catalyst `index.ts` 에서 **딱 6개 라인만** 제거 (Button/Input/Dialog/Checkbox/Radio/Select). 나머지 catalyst slice 의 `export * from ...` 유지 — Task 9 의 핵심 정책 |
| Headless UI v2 의 `<Headless.Checkbox>` API 가 catalyst `CheckboxField` 의 (label + helper text) 슬롯 패턴과 모양 다름 → TrustThisDeviceCheckbox 코드 변경 폭 큼 | Medium | Low | Task 4 에서 `CheckboxField` wrapper 컴포넌트로 catalyst 동등 슬롯 제공 — 사용처 변경 최소화 |
| 사용처 0건 컴포넌트(Toast/Tooltip/Select/Radio) 가 실제 사용 단계에서 API 부족 발견 → v1.1 에 재설계 비용 | Medium | Low | 각 컴포넌트의 **최소 API 만** 노출. multi-select / placement / variant 확장은 PRD Out of scope 의 v1.1 명시 |
| Dark mode 에서 focus indicator `ring-accent` 가 `bg-surface-elevated` 대비 3:1 미만 | Medium | Medium | Task 1-8 각 단위 테스트에 `tokens.css` 의 dark override token contrast 검증 — [mobile-ui-guide §4.2](../rules/ecc/web/mobile-ui-guide.md) 의 `--color-accent-soft` ring fallback 적용 |
| Tooltip 의 hover-trigger 가 mobile/touch 환경에서 무의미 — 정보 손실 위험 | Medium | Medium | Task 8 에서 touch detect (matchMedia hover/pointer 쿼리) 시 *표시 안 함* + 가이드 주석으로 "tooltip 의존 시 `aria-label` 보완" 박제 |
| Capacitor Android WebView 의 GPU 부담 — motion `transform`/`opacity` 외 사용 시 lag | Low | Low | [mobile-ui-guide §2.3](../rules/ecc/web/mobile-ui-guide.md) compositor-friendly property 만 사용 (이미 박제됨). 각 Task 의 styles 파일에서 layout-bound property animate 0건 검증 |
| 본 plan/구현이 main worktree 에서 진행되면 worktree-first 정책 위반 + 다른 multi-track 작업과 충돌 | Low | Medium | 본 plan 의 *실행* 은 `.worktrees/design-system-v1-headless/` + branch `feat/design-system-v1-headless` 에서. plan 파일 자체는 main 에서 작성·commit 후 worktree bootstrap |

## Acceptance

- [ ] Task 1-9 모두 complete + 각 validate 통과
- [ ] `services/web` `npm run lint && npm run build && npm test` 통과
- [ ] `git grep -E "from '@/shared/ui/catalyst/(button|input|dialog|checkbox|radio|select)'" -- 'services/web/src/**'` 결과 0건 (PRD Success Metric "핵심 8개 catalyst 의존 제거 = 8/8")
- [ ] 8개 신규 슬라이스의 단위 테스트 100% 통과 — 각 테스트 파일에 ARIA + hit-area(48dp) + focus-visible + dark mode contrast assertion 포함 (PRD Success Metric "WCAG 2.2 AA")
- [ ] `npm run cap:sync` 통과 — Capacitor Android WebView 호환성
- [ ] PRD `Delivery Milestones` #2 row update: `pending` → `done`, Plan 셀에 `[design-system-v1-headless-migration.plan.md](../plans/design-system-v1-headless-migration.plan.md)`
- [ ] Milestone 3 인계 — Task 9 의 catalyst `index.ts` 6 라인 제거가 Milestone 3 의 lint rule (`no-restricted-imports`) 적용 직전 baseline 으로 동작

---
name: services-web-component-catalog
description: Catalyst 제거 + headlessui primitive 위에 자체 컴포넌트 작성 카탈로그
status: pending
created: 2026-05-26
---

# Component Catalog — Catalyst 제거 후 자체 headless 컴포넌트

> 사용자 지시: "Catalyst UI를 걷어내고...Headless를 이용한 Custom Component로 관리".
> 본 문서는 **Phase 2 의 실행 reference** — 어떤 Catalyst 컴포넌트가 어떤 headlessui primitive 위에 어떻게 다시 작성되는지 1:1 매핑.

---

## 1. 원칙

1. **headlessui primitive 직접 wrap** — Catalyst 처럼 그러나 zinc 강제 없이.
2. **토큰만으로 스타일** — `tokens.css` 의 `--color-*`/`--text-*`/`--radius-*`/`--motion-*` 만 사용. 인라인 `style` 금지.
3. **위치**: `services/web/src/shared/ui/` (Catalyst 자리). 신규 자체 컴포넌트는 `shared/ui/catalyst/` 가 아닌 컴포넌트별 디렉토리.
4. **마이그레이션 전략**: Catalyst 디렉토리를 **즉시 제거하지 않음**. Phase 2 에서 컴포넌트 단위로 점진 교체 → 모든 사용처 갱신 → Catalyst 디렉토리 일괄 삭제.
5. **headlessui 미사용 컴포넌트** (Text, Heading, Divider 등) 는 순수 React + Tailwind 로 작성.

---

## 2. Catalyst → Custom 매핑

### 우선순위 분류

- **P0 (Phase 2 MVP 직전 필수)**: drive 페이지에 즉시 등장하는 layout/navigation
- **P1 (Phase 3~5 MVP Must 의존)**: upload·preview·invitation feature 의 사용 컴포넌트
- **P2 (Phase 7~9 Should)**: folder/trash/search 에 등장
- **P3 (Phase 10 Polish)**: 잘 안 쓰이지만 1회 이상 사용

### 매핑 표

| Catalyst | headlessui Primitive | 자체 컴포넌트 위치 | 우선순위 | 주요 토큰 |
|---|---|---|---|---|
| `alert` | — (순수 React) | `shared/ui/alert/Alert.tsx` | P1 | `--color-danger-soft`, `--radius-md` |
| `auth-layout` | — | `shared/ui/auth-layout/AuthLayout.tsx` | P0 | `--spacing-section`, `--color-surface` |
| `avatar` | — | `shared/ui/avatar/Avatar.tsx` | P0 | `--radius-pill`, `--text-sm` |
| `badge` | — | `shared/ui/badge/Badge.tsx` | P1 | `--color-accent-soft`, `--radius-pill` |
| `button` | `@headlessui/react` Button | `shared/ui/button/Button.tsx` | P0 | `--color-accent`, `--motion-ease-out` |
| `checkbox` | `@headlessui/react` Checkbox | `shared/ui/checkbox/Checkbox.tsx` | P1 | `--color-accent`, `--color-border` |
| `combobox` | `@headlessui/react` Combobox | `shared/ui/combobox/Combobox.tsx` | P2 (Search) | `--color-border`, `--radius-md` |
| `description-list` | — | `shared/ui/description-list/DescriptionList.tsx` | P1 | `--text-sm`, `--color-text-muted` |
| `dialog` | `@headlessui/react` Dialog + Transition | `shared/ui/dialog/Dialog.tsx` | P0 (모바일 sidebar drawer) | `--color-surface-elevated`, `--motion-ease-out` |
| `divider` | — | `shared/ui/divider/Divider.tsx` | P1 | `--color-border` |
| `dropdown` | `@headlessui/react` Menu | `shared/ui/dropdown/Dropdown.tsx` | P0 (사용자 메뉴) | `--color-surface-elevated`, `--radius-md` |
| `fieldset` | — | `shared/ui/fieldset/Fieldset.tsx` | P1 (form) | `--spacing-gutter` |
| `heading` | — | `shared/ui/heading/Heading.tsx` | P0 | `--text-2xl`/`--text-3xl` |
| `input` | — | `shared/ui/input/Input.tsx` | P0 (login form) | `--color-border`, `--color-accent` (focus) |
| `link` | — (Link wrapper) | `shared/ui/link/Link.tsx` | P0 | `--color-accent` |
| `listbox` | `@headlessui/react` Listbox | `shared/ui/listbox/Listbox.tsx` | P2 | `--color-surface-elevated` |
| `navbar` | — | `shared/ui/navbar/Navbar.tsx` | P1 | `--color-surface`, `--spacing-safe-top` |
| `pagination` | — | `shared/ui/pagination/Pagination.tsx` | P2 | `--text-sm`, `--radius-md` |
| `radio` | `@headlessui/react` RadioGroup | `shared/ui/radio/Radio.tsx` | P2 | `--color-accent` |
| `select` | `@headlessui/react` Listbox | `shared/ui/select/Select.tsx` | P1 | `--color-border` |
| `sidebar` | — (Disclosure on mobile) | `shared/ui/sidebar/Sidebar.tsx` | P0 | `--color-surface`, `--spacing-safe-bottom` |
| `sidebar-layout` | — | `shared/ui/sidebar-layout/SidebarLayout.tsx` | P0 | layout primitive |
| `stacked-layout` | — | `shared/ui/stacked-layout/StackedLayout.tsx` | P3 | layout primitive |
| `switch` | `@headlessui/react` Switch | `shared/ui/switch/Switch.tsx` | P3 | `--color-accent`, `--motion-ease-spring` |
| `table` | — | `shared/ui/table/Table.tsx` | P1 (file list desktop) | `--color-border`, `--text-sm` |
| `text` | — | `shared/ui/text/Text.tsx` | P0 | `--text-base`, `--color-text` |
| `textarea` | — | `shared/ui/textarea/Textarea.tsx` | P2 | `--color-border` |

총 26 개 컴포넌트.

---

## 3. 컴포넌트 작성 컨벤션 (Phase 2 적용)

### 디렉토리 구조

```
shared/ui/button/
  Button.tsx           # 컴포넌트 본체
  Button.test.tsx      # vitest + RTL
  index.ts             # public surface
```

### Props 패턴 (sketch)

```ts
// shared/ui/button/Button.tsx
import { Button as HeadlessButton } from '@headlessui/react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

interface ButtonProps extends ComponentProps<typeof HeadlessButton> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <HeadlessButton
      className={cn(
        'inline-flex items-center justify-center font-medium transition',
        'duration-(--motion-duration-normal) ease-(--motion-ease-out)',
        // variant
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent-hover',
        variant === 'ghost' && 'text-text hover:bg-surface-muted',
        variant === 'danger' && 'bg-danger text-accent-fg',
        // size
        size === 'sm' && 'h-9 px-3 text-sm rounded-md',
        size === 'md' && 'h-11 px-4 text-base rounded-md',
        size === 'lg' && 'h-12 px-5 text-lg rounded-lg',
        className,
      )}
      {...rest}
    />
  );
}
```

(실제 구현은 Phase 2 task. 위 스케치는 토큰 사용 방식과 props 형태만 박제.)

### 금지 사항

- Catalyst 컴포넌트 직접 사용 — 마이그레이션 완료된 컴포넌트는 즉시 Catalyst import 제거
- 인라인 `style` — 모든 시각 결정은 토큰 + utility class
- zinc-* 직접 사용 — 새 컴포넌트는 `--color-surface*` / `--color-text*` / `--color-border*` 만 사용
- headlessui primitive 우회 — 접근성·키보드 핸들링은 primitive 가 책임

---

## 4. 마이그레이션 순서 (Phase 2 가 실행)

1. **Layout 먼저** — `auth-layout` / `sidebar-layout` / `sidebar` / `navbar` (drive 페이지가 즉시 사용)
2. **Form primitives** — `button` / `input` / `link` / `text` / `heading` (login·register form)
3. **Action primitives** — `dialog` / `dropdown` / `avatar` (sidebar 드롭다운, 모바일 drawer)
4. **Data display** — `table` / `description-list` / `badge` (Phase 4 파일 목록)
5. **Feedback** — `alert` / `divider` (각 phase 진행 중)
6. **Form 확장** — `checkbox` / `radio` / `select` / `combobox` / `textarea` / `switch` / `fieldset`
7. **Polish** — `pagination` / `listbox` / `stacked-layout`

각 컴포넌트는 (a) 자체 작성 → (b) 모든 사용처 갱신 → (c) Catalyst 카운터파트 제거의 3 단계 사이클.

---

## 5. Done 체크리스트 (Phase 2 종료 시)

- [ ] `shared/ui/catalyst/` 디렉토리 완전 삭제
- [ ] `shared/ui/index.ts` 의 catalyst re-export 제거
- [ ] 26 개 컴포넌트 모두 자체 구현 + 테스트
- [ ] services/web 전체에서 catalyst import 0 건 (`grep -r "shared/ui/catalyst"` empty)
- [ ] 시각 회귀 검증: 토큰만 사용하는 화면 (login/drive/register) 비교

---

## Notes

- `@headlessui/react` 는 Catalyst 가 이미 의존하고 있어 `package.json` 추가 dependency 0.
- headlessui 미사용 컴포넌트 (text/heading/divider 등) 는 순수 React + Tailwind 로 작성 — primitive 가 필요 없는 경우 추가 추상화 금지.
- 본 카탈로그는 Phase 2 종료 시 frontmatter `status: pending` → `done` 갱신.

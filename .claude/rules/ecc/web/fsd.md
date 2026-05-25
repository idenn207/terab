---
paths:
  - "services/web/src/**/*.ts"
  - "services/web/src/**/*.tsx"
---
# Feature-Sliced Design (FSD)

> This file extends [common/patterns.md](../common/patterns.md) and [web/patterns.md](patterns.md) with FSD-specific structural rules.
>
> Detailed widget-vs-feature decision flow and project-specific examples live in [services/web/CLAUDE.md §"아키텍처 개요"](../../../../services/web/CLAUDE.md). This rule encodes the cross-project FSD principles enforced for `services/web`.

## Layer Dependency Direction

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
```

A layer may only import from layers to its right. Reverse imports are forbidden.

| Importer | May import from | May NOT import from |
|---|---|---|
| `app` | pages, widgets, features, entities, shared | (nothing above) |
| `pages` | widgets, features, entities, shared | app |
| `widgets` | features, entities, shared | app, pages |
| `features` | entities, shared | app, pages, widgets, **other features** |
| `entities` | shared | app, pages, widgets, features, **other entities** |
| `shared` | (only other `shared`) | everything above |

### Cross-Slice Within the Same Layer Is Forbidden

Two slices on the same layer must not import each other. Lift shared logic to `shared/`.

```typescript
// WRONG: features/file-upload reaches into features/login-by-credentials
import { useAuth } from '@/features/login-by-credentials/model/useAuth'

// CORRECT: shared helper, or read auth state from entities/user
import { useUserStore } from '@/entities'
```

## Slice Boundary — `index.ts` Only

Each slice has an `index.ts` that defines its public surface. External code imports through the barrel; the slice's internal paths are private.

```typescript
// WRONG: bypasses the slice boundary, locks the import to internal structure
import { useLogin } from '@/features/login-by-credentials/model/useLogin'

// CORRECT: uses the slice's public surface
import { useLogin } from '@/features/login-by-credentials'
```

Slice authors decide what to export. Anything not in the barrel is internal and may be moved or renamed without breaking callers.

## Segment Dependency Direction

Inside a slice, segments follow a one-way flow:

```
api  →  model  →  ui
```

| Importer | May import from | May NOT import from |
|---|---|---|
| `api` | (nothing in the slice) | model, ui |
| `model` | api | ui |
| `ui` | model | api (must go through model) |

```typescript
// WRONG: ui talks to api directly
// features/file-upload/ui/UploadButton.tsx
import { useUploadMutation } from '../api/mutation'

// CORRECT: ui → model → api
// features/file-upload/ui/UploadButton.tsx
import { useUploadFile } from '../model/useUploadFile'
```

## `api/` Is Slice-Private

The `api/` segment wraps codegen output (hey-api SDK + TanStack Query options). It must **not** be exported from the slice barrel.

```typescript
// features/file-upload/index.ts
export { useUploadFile } from './model/useUploadFile'  // ✅ model
export { UploadButton } from './ui/UploadButton'       // ✅ ui
// ❌ export { useUploadMutation } from './api/mutation'  — api stays private
```

`model` files reach the codegen layer **through** the slice's own `api/` wrapper. Direct codegen-function imports inside `model` are forbidden (type imports are fine).

```typescript
// WRONG: model imports a codegen function directly
import { loginMutation } from '@shared/api'

// CORRECT: model goes through the slice's api wrapper
import { useLoginMutation } from '../api/mutation'
```

## Widgets vs Features

The dividing question: **one user action, or a composition of actions?**

| Surface | Layer | Owns |
|---|---|---|
| Single action with business logic (mutation, query, state change) | `features/{slice}` | The action's API wrapper, hook, and triggering UI |
| Composition of actions or features into a layout region | `widgets/{slice}` | Layout / placement only — no business logic of its own |

A feature whose `ui/` is empty is either incomplete or misclassified as a widget. Layout-only surfaces belong in `widgets`.

## State Ownership

Different kinds of state live in different layers/tools. Do not mix them.

| Kind | Tool | Where |
|---|---|---|
| Server data (User, File, etc.) | TanStack Query cache | Read via the slice's `api/` wrapper hooks |
| Client session (e.g., accessToken) | Zustand store | `entities/{domain}/model/` |
| Cross-component UI state (modal open, selected tab) | Zustand or `useState` lifted to a feature/widget | `features/{name}/model/` or local |
| Local UI state | `useState` | Inside the component |
| Form state | React Hook Form | Inside the form component |

**Never duplicate server state into a Zustand store.** Read `useMeQuery()` (or equivalent) — don't shadow it with `useUserStore.user`.

## Forbidden Patterns

| Forbidden | Reason | Replace with |
|---|---|---|
| Same-layer cross-slice import | Couples slices that should be independent | Lift shared logic to `shared/` |
| Importing a slice via internal path | Bypasses the public surface | Import through the barrel `index.ts` |
| Exporting `api/` from the slice barrel | Leaks codegen wrappers to external slices | Keep `api/` private; expose model/ui |
| `model` directly importing codegen functions | Breaks the `api → model → ui` direction | Import the slice's own `api/` wrapper |
| Server data duplicated into Zustand | Two sources of truth, drift guaranteed | TanStack Query cache only |
| `useUserStore()` full subscription | Re-renders on every field change | `useUserStore((s) => s.field)` selector |
| Direct mutation of store state (`state.x = ...`) | Breaks immutability + reactivity | `set((s) => ({ ...s, x: ... }))` |
| Inline-style props | Bypasses the design token system | Tailwind utility classes |

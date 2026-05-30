# shared/ui/catalyst — 임시·마이그레이션 대상

> **1차 권위 source**: [.claude/rules/ecc/web/mobile-ui-guide.md §8](../../../../../../.claude/rules/ecc/web/mobile-ui-guide.md). 본 README 는 §8.1~§8.5 의 operational 사본 — 정책 변경 시 가이드를 먼저 갱신한다.

## 정체

- 위치: `services/web/src/shared/ui/catalyst/**`
- 정체: Tailwind UI / catalyst kit 의 *예시* 컴포넌트. 빠른 스파이크용으로 임시 채용된 코드다.
- 본 가이드의 §2~§7 (Material anatomy, WCAG 2.2 AA, token, trend) 어느 항목과도 *명시적 일치 보장이 없다*.

## 신규 코드에서 import 금지

- `@/shared/ui/catalyst/*` 직접 import 는 ESLint `no-restricted-imports` 로 **error 차단**. 위반 시 `npm run lint` 실패.
- 기존 사용처가 catalyst 컴포넌트가 필요하면 반드시 **`@/shared/ui` barrel 경유**.
- 신규 컴포넌트는 `shared/ui/{component}/` headless 슬라이스 신설 후 사용 — Material anatomy + tokens.css + WCAG 2.2 AA 통과.

| 상황 | 허용 여부 | 대안 |
| --- | --- | --- |
| 신규 컴포넌트가 catalyst 직접 import | ❌ ESLint error | `shared/ui/{component}/` headless 신설 또는 `@/shared/ui` barrel 경유 |
| 기존 사용처 유지 (시각 변경 없음) | ⚠️ 허용 | `// TODO(design-system-v1): catalyst → headless 마이그레이션` 주석 표기 |
| 기존 catalyst 컴포넌트 직접 수정 | ❌ 금지 | catalyst 원본 보존 — 래퍼·확장 금지, headless 신설로 대체 |
| catalyst 의 hex·`px` 값을 신규 컴포넌트가 답습 | ❌ 금지 | tokens.css 의 utility token 으로 재해석 |

## Milestone 2 — headless 대체 완료 표 (핵심 8개)

| 컴포넌트 | catalyst 경로 | headless 위치 | §2.2 anatomy |
| --- | --- | --- | --- |
| Button | `catalyst/button/` | `shared/ui/button/` | Material Buttons |
| Input (Text Field) | `catalyst/input/` | `shared/ui/input/` | Material Text Fields |
| Modal (Dialog) | `catalyst/dialog/` | `shared/ui/modal/` | Material Dialog + Bottom Sheet 분기 |
| Toast | — (신설) | `shared/ui/toast/` | Material Snackbar |
| Tooltip | — (신설) | `shared/ui/tooltip/` | Material Tooltip |
| Select | `catalyst/select/` | `shared/ui/select/` | Material Menu (single-select) |
| Checkbox | `catalyst/checkbox/` | `shared/ui/checkbox/` | Material Checkbox |
| Radio | `catalyst/radio/` | `shared/ui/radio/` | Material Radio |

> catalyst 의 `button/checkbox/dialog/input/radio/select` 디렉토리는 잔존하지만 **신규 코드에서 사용 금지** — headless 슬라이스가 1차 선택. catalyst 잔존은 v1.X 디렉토리 일괄 제거 시점까지의 임시 보존.

## 잔존 catalyst 슬라이스 (21개) — v1.X 제거 대상

`shared/ui/catalyst/index.ts` 의 명시적 named export 와 1:1 일치한다. 신규 사용처 추가 시 PR 리뷰 차단.

| # | 슬라이스 | # | 슬라이스 |
| --- | --- | --- | --- |
| 1 | alert | 12 | listbox |
| 2 | auth-layout | 13 | navbar |
| 3 | avatar | 14 | pagination |
| 4 | badge | 15 | sidebar |
| 5 | combobox | 16 | sidebar-layout |
| 6 | description-list | 17 | stacked-layout |
| 7 | divider | 18 | switch |
| 8 | dropdown | 19 | table |
| 9 | fieldset | 20 | text |
| 10 | heading | 21 | textarea |
| 11 | link | | |

> 잔존 슬라이스에 신규 의존을 더하지 않는 것이 일순위. headless 마이그레이션 우선순위는 [PRD design-system-v1](../../../../../../.claude/prds/design-system-v1.prd.md) 의 v1.X 후속 milestone 에서 결정.

## v1.X 제거 시점

- v1.0 출시 = Milestone 2 완료(핵심 8개 headless 교체) 시점. **현재 baseline.**
- v1.0 의 잔존 21개 슬라이스는 [PRD Out of scope](../../../../../../.claude/prds/design-system-v1.prd.md) — v1.1 이후 별도 PRD 로 마이그레이션.
- catalyst 디렉토리 *자체* 제거는 잔존 슬라이스 전수 headless 마이그레이션 완료 후.

## 신규 catalyst 사용처 추가 — 항상 `@/shared/ui` barrel 경유

`shared/ui/index.ts` 가 catalyst 의 모든 named export 를 외부에 노출한다. 외부 슬라이스는 *반드시* barrel 만 사용.

```ts
// ✅ 허용 — @/shared/ui barrel 경유
import { Alert, Badge } from '@/shared/ui';

// ❌ ESLint error — 직접 import 차단
import { Alert } from '@/shared/ui/catalyst/alert';
import { Alert } from '@/shared/ui/catalyst';
```

위반 시 ESLint message: `catalyst 는 v1.X 제거 예정 — 신규 import 금지. @/shared/ui (barrel) 경유로 import. 정책: services/web/src/shared/ui/catalyst/README.md`.

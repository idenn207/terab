# Plan: design-system-v1 — catalyst 종속 표면화 + 신규 import 차단

**Source PRD**: [.claude/prds/design-system-v1.prd.md](../prds/design-system-v1.prd.md)
**Selected Milestone**: #3 catalyst 종속 표면화 + 신규 import 차단
**Complexity**: Small
**Worktree**: `.worktrees/design-system-v1-catalyst-lockdown/` · branch `chore/design-system-v1-catalyst-lockdown`

## Summary

catalyst 디렉토리에 (a) README 로 임시·마이그레이션 대상 의도를 박제하고, (b) ESLint `no-restricted-imports` 로 `@/shared/ui/catalyst/*` 직접 import 를 차단해 신규 코드가 반드시 `@/shared/ui` barrel 경유하도록 강제한다. Milestone 2 가 이미 핵심 8개를 headless 로 교체하고 barrel 을 정리한 baseline 위에서, 잔존 21개 catalyst 슬라이스가 *v1.X 제거 예정*임을 권위 source 로 명문화한다.

## Pre-decisions

| 결정 | 근거 |
|---|---|
| **branch type 은 `chore/`** | feature 가 아닌 정책·tooling 변경 (README + ESLint rule). [common/git-workflow.md](../../.claude/rules/ecc/common/git-workflow.md) 의 Conventional Commits type 분류 따름 |
| **ESLint config 양식은 Task 3 진입 직전 확인** | flat config (`eslint.config.js`) vs legacy (`.eslintrc.*`) 양식 차이만 있고 rule 자체는 동일. 양식 추정으로 본 plan 에 적지 않음 |
| **stale duplicate `.claude/plans/design-system-v1-headless-migration.plan.md` 는 본 plan 범위 밖** | 별도 chore commit 으로 정리 — 본 plan 의 acceptance 와 무관 |
| **barrel re-export 만 허용 = `@/shared/ui/catalyst/*` 직접 import 전면 금지** | Milestone 2 Task 9 가 `shared/ui/index.ts` 를 명시적 named re-export 로 정리해 둠. 이미 baseline 완료, rule 추가만으로 신규 import 차단 가능 |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 정책 권위 source | [.claude/rules/ecc/web/mobile-ui-guide.md §8](../rules/ecc/web/mobile-ui-guide.md) | catalyst 임시 선언·신규 import 금지·잔존 21개 표가 이미 §8.1~§8.5 에 정리. README 는 §8 의 *operational* 사본 — claude rule 의 권위 source 와 1:1 정합 유지 |
| barrel 정책 | [services/web/src/shared/ui/index.ts](../../services/web/src/shared/ui/index.ts) (Milestone 2 Task 9 산출물) | catalyst 잔존 21개를 named re-export. 신규 catalyst import 는 반드시 이 barrel 경유 |
| 함수·식별자 네이밍 | [services/web/CLAUDE.md](../../services/web/CLAUDE.md) | 본 plan 의 모든 식별자는 web CLAUDE.md 의 컨벤션 |
| 커밋 메시지 | [.claude/rules/ecc/common/git-workflow.md](../../.claude/rules/ecc/common/git-workflow.md) | Conventional Commits — subject 한글, 명사형/동사 원형 종결 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `services/web/src/shared/ui/catalyst/README.md` | CREATE | catalyst 임시·금지·잔존 표 박제 (mobile-ui-guide §8 의 operational 사본) |
| `services/web/eslint.config.*` (양식은 Task 3 에서 확인) | UPDATE | `no-restricted-imports` patterns 추가 |
| `services/web/src/**` (Task 2 결과 따라 결정) | UPDATE | `from '@/shared/ui/catalyst/...'` 직접 import 잔존 시 barrel 경유로 정리 |
| `services/web/src/shared/ui/index.ts` (Task 2 결과 따라 결정) | UPDATE | barrel 에 누락된 named export 보강 |
| `.claude/prds/design-system-v1.prd.md` | UPDATE | Milestone 3 row `pending` → `in-progress` (plan 작성 직후) → `done` (구현 완료 후) + Plan 셀 갱신 |

## Tasks

### Task 1 — catalyst README 신설

**Action**:

1. `services/web/src/shared/ui/catalyst/README.md` 신설. 본문 구성:
   - **임시·마이그레이션 대상 선언** — [mobile-ui-guide §8.1](../rules/ecc/web/mobile-ui-guide.md) 와 1:1 정합
   - **신규 코드에서 import 금지** — ESLint rule (Task 3) 이 강제, 위반 시 error
   - **headless 대체 완료 표** — Milestone 2 의 핵심 8개 (Button/Input/Dialog→Modal/Checkbox/Radio/Select + Toast/Tooltip 신설)
   - **잔존 catalyst 슬라이스 표** — `shared/ui/catalyst/index.ts` 의 실제 export 와 일치 (alert / auth-layout / avatar / badge / combobox / description-list / divider / dropdown / fieldset / heading / link / listbox / navbar / pagination / sidebar / sidebar-layout / stacked-layout / switch / table / text / textarea)
   - **v1.X 제거 시점** — 잔존 슬라이스 전수 headless 마이그레이션 후
   - **신규 catalyst 사용처 추가 금지 — 반드시 `@/shared/ui` barrel 경유**

2. README 가 [mobile-ui-guide §8](../rules/ecc/web/mobile-ui-guide.md) 을 권위 source 로 명시 link — 정책 변경 시 가이드만 갱신하면 README 가 자동 따라가는 구조.

**Mirror**: [mobile-ui-guide §8.1~§8.5](../rules/ecc/web/mobile-ui-guide.md) 의 표 구조 그대로 차용

**Validate**:

```bash
test -f services/web/src/shared/ui/catalyst/README.md
# README 의 잔존 슬라이스 표가 catalyst/index.ts 의 export 와 일치하는지 수동 cross-check
```

### Task 2 — `@/shared/ui/catalyst/*` 직접 import 사용처 정리 (Task 3 선행)

**Action**:

1. 전수 추출:
   ```bash
   git grep -nE "from '@/shared/ui/catalyst/" services/web/src
   git grep -nE 'from "@/shared/ui/catalyst/' services/web/src
   ```

2. 발견된 모든 직접 import 를 `@/shared/ui` (barrel) 경유로 교체.

3. barrel 에서 누락된 named export 가 있으면 `services/web/src/shared/ui/index.ts` 에 보강.

4. 보강된 barrel 이 catalyst `index.ts` 의 모든 named export 와 일치하는지 verify (잔존 21개 슬라이스 × 각 슬라이스의 named exports 표).

5. **Milestone 2 의 barrel 정책 유지** — `export * from './catalyst'` 같은 wildcard 재도입 금지. 모든 catalyst 잔존은 *명시적 named export* 로만.

**Mirror**: [services/web/src/shared/ui/index.ts](../../services/web/src/shared/ui/index.ts) (Milestone 2 산출물)

**Validate**:

```bash
git grep -nE "from '@/shared/ui/catalyst/" services/web/src && exit 1 || echo "OK: 직접 import 0건"
cd services/web
npm run build                                        # named export 누락 시 컴파일 에러로 catch
```

### Task 3 — ESLint `no-restricted-imports` rule

**Action**:

1. `services/web/eslint.config.*` 파일 양식 확인 (flat vs legacy).

2. rules 에 추가 — *flat config 가정 예시*:
   ```js
   rules: {
     'no-restricted-imports': ['error', {
       patterns: [{
         group: ['@/shared/ui/catalyst', '@/shared/ui/catalyst/*'],
         message: 'catalyst 는 v1.X 제거 예정 — 신규 import 금지. @/shared/ui (barrel) 경유로 import. 정책: services/web/src/shared/ui/catalyst/README.md',
       }],
     }],
   }
   ```

3. **`shared/ui/catalyst/**` 자체 override** — rule 이 catalyst 내부 component 끼리의 상호 import 까지 차단하지 않도록 file-level override:
   ```js
   {
     files: ['services/web/src/shared/ui/catalyst/**'],
     rules: { 'no-restricted-imports': 'off' },
   }
   ```

   또한 barrel 파일 자체(`services/web/src/shared/ui/index.ts`)도 override — barrel 이 합법적으로 catalyst 를 re-export 해야 함.

4. **의도적 invalid import 시뮬레이션** — 임시 파일에 `import { Alert } from '@/shared/ui/catalyst/alert';` 추가 → `npm run lint` 가 error report 확인 → revert.

**Mirror**: ESLint flat config 의 file-level override 패턴 — services/web 의 기존 config 가 사용 중인 양식 그대로 따름

**Validate**:

```bash
cd services/web
npm run lint                                         # rule 적용 후 통과
# 의도적 invalid 케이스
echo 'import { Alert } from "@/shared/ui/catalyst/alert";' >> src/__lint-probe.ts
npm run lint                                         # → error 발생 확인
rm src/__lint-probe.ts
```

### Task 4 — PRD Milestone 3 상태 update

**Action**:

1. `.claude/prds/design-system-v1.prd.md` 의 `Delivery Milestones` 표 Milestone #3 row:
   - 본 plan 작성 직후 → `pending` → `in-progress`, Plan 셀: `[design-system-v1-catalyst-lockdown.plan.md](../plans/design-system-v1-catalyst-lockdown.plan.md)`
   - Task 1~3 구현 완료 후 → `in-progress` → `done`

2. 다른 row 는 건드리지 않음.

**Validate**:

```bash
git diff .claude/prds/design-system-v1.prd.md       # 3번 row + 본 plan 경로 외 변경 0건
```

## Validation (전체)

```bash
cd services/web
npm run lint                                         # ESLint rule 적용 + 위반 0건
npm run build                                        # tsc -b + vite build
npm test                                             # Milestone 2 의 8개 슬라이스 단위 테스트 회귀 없음

# Success Metrics 검증
git grep -nE "from '@/shared/ui/catalyst/" src       # → 0건
test -f src/shared/ui/catalyst/README.md             # README 존재
```

PRD Success Metrics 와 매핑:

| PRD Metric | 본 plan 검증 |
|---|---|
| 핵심 8개 컴포넌트의 catalyst 의존 제거 = 8/8 | Milestone 2 에서 이미 달성. 본 plan 은 *유지* 만 검증 (`git grep` 0건) |
| 신규 catalyst import 차단 | Task 3 의 ESLint rule + 의도적 invalid 시뮬레이션 |
| catalyst 임시·마이그레이션 대상 명문화 | Task 1 의 README + [mobile-ui-guide §8](../rules/ecc/web/mobile-ui-guide.md) cross-ref |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 기존 `@/shared/ui/catalyst/*` 직접 import 가 다수 → Task 2 refactor 폭이 큼 | Medium | Medium | Milestone 2 가 핵심 8개에 대해 이미 정리. 잔존 21개에 대해 직접 import 가 있다면 grep → 표 → Edit 일괄. `npm run build` 가 누락 즉시 catch |
| ESLint flat vs legacy config 양식 차이 — rule 양식 mismatch | Low | Low | Task 3 진입 직전에 `services/web/eslint.config.*` 확인 후 양식 맞춤 |
| barrel `services/web/src/shared/ui/index.ts` 에서 잔존 21개 named export 누락 → refactor 시 컴파일 에러 | Medium | Medium | Task 2 직전 catalyst `index.ts` 의 모든 named export 와 barrel 의 named export 를 표로 cross-check. 누락 즉시 보강 |
| ESLint rule 이 catalyst 내부 상호 import 까지 차단 → catalyst slice 들이 서로 깨짐 | Low | High | Task 3 의 `shared/ui/catalyst/**` file-level override 로 차단 |
| `no-restricted-imports` 가 IDE auto-import 와 충돌 — DX 저하 | Low | Low | error 메시지가 명확하면 IDE 즉시 표시. 학습 비용 낮음 |
| Task 4 의 PRD update 가 main 의 stale `.claude/plans/design-system-v1-headless-migration.plan.md` 와 merge conflict | Low | Low | 본 plan 의 Pre-decisions 에서 명시 — stale plan 은 별도 chore commit. 본 plan 머지 시점 충돌은 별도 정리 |
| 본 plan/구현이 main worktree 에서 진행되면 worktree-first 정책 위반 | Low | Medium | 본 plan 의 *실행* 은 `.worktrees/design-system-v1-catalyst-lockdown/` + branch `chore/design-system-v1-catalyst-lockdown` 에서만 |

## Acceptance

- [ ] Task 1: `services/web/src/shared/ui/catalyst/README.md` 신설 + 임시·금지·잔존 표 박제
- [ ] Task 2: `git grep -nE "from '@/shared/ui/catalyst/" services/web/src` → 0건
- [ ] Task 3: ESLint `no-restricted-imports` rule 추가 + `npm run lint` 통과 + 의도적 invalid 케이스에서 error report 확인
- [ ] Task 4: PRD `Delivery Milestones` #3 row `pending` → `done`, Plan 셀에 `[design-system-v1-catalyst-lockdown.plan.md](../plans/design-system-v1-catalyst-lockdown.plan.md)`
- [ ] Validation 전체: `npm run lint && npm run build && npm test` 통과
- [ ] PRD Success Metrics: 가이드 적용 컴포넌트의 WCAG 2.2 AA 통과 (Milestone 2 에서 이미 달성 — 본 plan 회귀 없음 검증)

---
slug: design-system-v1-1-enforcement
status: draft
milestone: 2
prd: .claude/prds/design-system-v1-1-foundations.prd.md
worktree: .worktrees/design-system-v1-1-enforcement
branch: feat/design-system-v1-1-enforcement
base: v0.1
---

# Plan — design-system v1.1 milestone 2: 4단 cross-check 강제 메커니즘

## 요약

[PRD design-system-v1-1-foundations](../prds/design-system-v1-1-foundations.prd.md) 의 **Milestone 2 — 4단 cross-check 강제 메커니즘 도입**을 구현한다. PRD §Scope §"강제 메커니즘 4단" 표의 (1) plan checklist · (2) PR template + pre-commit · (3) code-reviewer agent prompt + eslint · (4) Vitest snapshot 을 본 plan 의 *4 Phase* 로 매핑한다.

**PRD §Risks 의 "단계적 활성화" mitigation 을 1차 출처로 채택** — 한 PR 로 4단 모두를 한꺼번에 활성하지 않는다. Phase 1 (plan checklist 만) 머지 → 2~3개 design PR 표본으로 false-positive 측정 → Phase 2 → Phase 3 → Phase 4 순차. 본 plan 은 *진입 게이트와 acceptance 만* 박제하고, 각 Phase 의 *완료 PR* 은 별도 PR 로 분리.

**복잡도**: Medium — Phase 1·2 는 markdown/template 패치라 작은데, Phase 3·4 는 OQ2 검증 결과에 따라 *도구 자체 교체 가능성* 이 있어 진행이 분기됨.

## PRD ↔ plan 매핑

| PRD §Scope 강제 메커니즘 | Phase | 주 산출물 | 단계적 활성화 게이트 |
|---|---|---|---|
| Stage 1: Plan 단계 — `/ecc:plan` skill 의 디자인 sub-checklist | **Phase 1** | `.github/PULL_REQUEST_TEMPLATE/web-component.md` 의 *plan 시점 인용* 섹션 + `.claude/plans/README.md` 에 design plan 의무 checklist | merge 후 신규 design plan 2건 작성 |
| Stage 2: PR 작성 시점 — PR template self-check + git grep 기반 pre-commit hook | **Phase 2** | `.github/PULL_REQUEST_TEMPLATE/web-component.md` (분리 template) + `scripts/check-design-tokens.mjs` + `package.json` 의 `lint:design-tokens` script | merge 후 신규 design PR 2~3건 측정 (false-positive ≤ 1건) |
| Stage 3: Code-review 시점 — code-reviewer agent prompt + `eslint-plugin-tailwindcss` token allowlist | **Phase 3** | `~/.claude/agents/code-reviewer.md` patch *or* project-local `.claude/agents/web-design-reviewer.md` 신설 + `services/web/eslint.config.js` patch + 대안 도구 결정 PR | Phase 2 측정 후 + OQ2 호환성 검증 통과 |
| Stage 4: Vitest 페이지군 token 회귀 snapshot | **Phase 4** | `services/web/src/pages/{family}/ui/__designtoken__/*.test.tsx` 3건 (auth / drive / admin) + baseline snapshot + CI 통합 | Phase 3 머지 후, 페이지군 family 별 baseline 확보 |

> 4 Phase 는 *순차 머지*. Phase 간 PR 분리 → false-positive 측정 → 다음 Phase 진입. 본 plan 의 acceptance 는 *Phase 1 머지* 까지만 책임 — Phase 2~4 는 본 plan 의 후속 plan 으로 분기 가능.

## Patterns to Mirror

| Category | Source (file:line) | Pattern |
|---|---|---|
| Plan 문서 형식 | [.claude/plans/design-system-v1-1-foundations.plan.md:1-12](../plans/design-system-v1-1-foundations.plan.md) | YAML frontmatter (slug/status/milestone/prd/worktree/branch/base) + 한글 단문 + 표 위주 + ✶ 없음 |
| 기존 PR template | [.github/PULL_REQUEST_TEMPLATE.md:1-24](../../.github/PULL_REQUEST_TEMPLATE.md) | 한글 단문, `## 요약 / 변경 내용 / 변경 유형 / 테스트 / 참고 사항` 5섹션. 본 plan 의 web-component template 은 *이 형식을 그대로 따른다 + 디자인 섹션만 추가* |
| ESLint v9 Flat config | [services/web/eslint.config.js:1-19](../../services/web/eslint.config.js) | `defineConfig` + `extends:[...]` + `files: ['**/*.{ts,tsx}']`. 새 rule 추가는 `extends` 또는 `rules` 키 |
| 테스트 위치 | [services/web/CLAUDE.md "테스트 파일 위치"](../../services/web/CLAUDE.md) + [services/web/src/pages/drive/ui/DrivePage.test.tsx](../../services/web/src/pages/drive/ui/DrivePage.test.tsx) | 슬라이스 내부 `ui/Component.test.tsx` 옆에 배치. `src/__tests__/` 는 *공유 인프라만* |
| script 위치 | [services/web/package.json:5-22](../../services/web/package.json) | `scripts/` 디렉토리 + `package.json scripts` 키에 `npm run <name>` 으로 노출 |
| Plan readme 컨벤션 | [.claude/plans/README.md](../plans/README.md) (존재 확인 필요) | design plan 인용 의무를 *기존 readme 의 추가 행* 으로 작성 |

> Pre-commit hook 자체는 *프로젝트에 husky 등이 없음* 을 확인 (package.json devDeps grep). 본 plan 은 *git hook 대신 `npm run lint:design-tokens` + GitHub Actions CI* 로 우회 — OS 별 hook 설치 부담 회피 + Windows/Linux 동등 작동.

## Open Question 결정 (PRD §Open Questions 중 OQ2 종결 시점)

| PRD OQ | 본 plan 의 결정 | Phase |
|---|---|---|
| **OQ2** `eslint-plugin-tailwindcss` × Tailwind 4 호환성 | **Phase 3 의 *첫 task* 로 호환성 PoC** — 비호환 시 *3 대안* 중 선택 (a) custom ESLint rule (b) `lint:design-tokens` script 확장 (c) Stylelint 로 분리 | Phase 3 |
| **OQ-N (신규)** Pre-commit hook 대신 CI 채택 | **CI 채택** — Windows/Linux 동등 + 신규 contributor onboarding 부담 0 | Phase 2 |
| **OQ-N (신규)** Vitest snapshot 의 위치 컨벤션 | **FSD 컨벤션 우선** — 페이지군 단위 snapshot 은 `src/pages/{family}/ui/__designtoken__/*.test.tsx` 또는 *각 페이지 `Page.designtoken.test.tsx`* | Phase 4 |
| **OQ-N (신규)** code-reviewer agent — global vs project-local | **project-local 우선** — `~/.claude/agents/` 의 global agent 를 patch 하면 *타 프로젝트* 에 누수. project-local `.claude/agents/web-design-reviewer.md` 로 분리 | Phase 3 |

## Files to Change

| Phase | 파일 | 변경 종류 | 비고 |
|---|---|---|---|
| 1 | [.github/PULL_REQUEST_TEMPLATE/web-component.md](../../.github/PULL_REQUEST_TEMPLATE/web-component.md) | CREATE | GitHub multiple template — `?template=web-component.md` 선택 시 노출. 디자인 변경 PR 만 사용 |
| 1 | [.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) | UPDATE | 본문 footer 에 *"디자인 변경 시 `?template=web-component.md` 사용"* 한 줄 추가 |
| 1 | [.claude/plans/README.md](../plans/README.md) | UPDATE (or CREATE if missing) | design plan 의 *§5.1.1 / §5.2.1 / §5.5 / §9 인용 의무* 명시 |
| 2 | [scripts/check-design-tokens.mjs](../../scripts/check-design-tokens.mjs) | CREATE | git grep 기반 — `from '@/shared/ui/catalyst/'` import 신규 감지 + inline `style=` + hardcoded hex/rgb/oklch literal 감지. 기존 catalyst 사용처 allowlist 는 commit log baseline 기준 |
| 2 | [services/web/package.json](../../services/web/package.json) | UPDATE | `"lint:design-tokens": "node ../../scripts/check-design-tokens.mjs src"` script 추가 (CWD = `services/web/` 기준 상대 경로 — Task 2.2 와 동일) |
| 2 | [.github/workflows/web-lint.yml](../../.github/workflows/web-lint.yml) | CREATE or UPDATE | `npm run lint:design-tokens` 를 PR CI 에 통합 (existing workflow 가 있으면 추가, 없으면 신설) |
| 3 | [.claude/agents/web-design-reviewer.md](../agents/web-design-reviewer.md) | CREATE | project-local agent — code-reviewer 의 *디자인 일관성 사양*. mobile-ui-guide §5.1.1 / §5.2.1 / §5.5 / §9 cross-check |
| 3 | [services/web/eslint.config.js](../../services/web/eslint.config.js) | UPDATE | OQ2 검증 결과에 따라 `eslint-plugin-tailwindcss` 또는 *대안* 추가. token allowlist 는 `--color-*` / `--text-*` / `--spacing-*` / `--radius-*` / `--motion-*` |
| 4 | [services/web/src/pages/login/ui/LoginPage.designtoken.test.tsx](../../services/web/src/pages/login/ui/LoginPage.designtoken.test.tsx) | CREATE | auth family snapshot baseline |
| 4 | [services/web/src/pages/drive/ui/DrivePage.designtoken.test.tsx](../../services/web/src/pages/drive/ui/DrivePage.designtoken.test.tsx) | CREATE | drive family snapshot baseline |
| 4 | [services/web/src/__tests__/design-tokens/](../../services/web/src/__tests__/design-tokens/) | CREATE | 페이지군 token util/matcher — `expectFamilyTokens(page, 'auth')` 형태의 공통 헬퍼 |

> Phase 4 는 admin family snapshot 을 *skip* — admin bootstrap 가 PR #61 으로 막 들어와 baseline 이 흔들림 (foundations plan §Risks 와 일관). admin 은 Phase 4 PR 본문에서 *deferred — admin scope 안정 후 별도 PR* 로 명시.

## Tasks

### Phase 1 — Plan checklist + PR template seed (본 plan 머지 대상)

#### Task 1.1 — `.claude/plans/README.md` 확인 + design plan 인용 의무 추가
- **Action**: 기존 README 가 존재하면 *§"design plan 작성 시"* 섹션 추가. 없으면 신설하고 `.claude/plans/` 전반 컨벤션 + design plan 의 mobile-ui-guide 인용 의무 박제.
- **Mirror**: [.claude/plans/design-system-v1-1-foundations.plan.md "PRD ↔ plan 매핑"](../plans/design-system-v1-1-foundations.plan.md) 의 표 형식
- **Validate**: `grep -E '^## 디자인 plan' .claude/plans/README.md` 가 hit

#### Task 1.2 — `.github/PULL_REQUEST_TEMPLATE/web-component.md` 신설
- **Action**: 기존 [PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) 의 5섹션 형식을 그대로 따르되, *§"디자인 self-check"* 단일 섹션을 추가. 항목 7건:
  1. mobile-ui-guide §2.2 anatomy 명시 (Material URL or 표 row 이름)
  2. §6.2 token utility 만 사용 (새 token 발명 0건)
  3. §4.1 WCAG criterion 8개 점검 (axe-core or 키보드)
  4. §2.3 motion token 만 사용 (layout-bound property animate 0건)
  5. §7.3 금지 trend 의 시각 어휘 0건
  6. §5.5 family 톤 유지 (auth/drive/admin route prefix)
  7. §9 Atomic 5단계 순서 (anatomy→token→a11y→motion→anti-template)
- **Mirror**: [.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) 의 한글 단문 + 체크박스 + `<!-- 주석 -->` 패턴
- **Validate**: 본 worktree 에서 `gh pr create --template web-component.md --web` dry-run 이 정상 라우팅 (또는 `git push` 후 GitHub web 에서 `?template=web-component.md` query 가 작동)

#### Task 1.3 — 기존 [PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) footer 한 줄 추가
- **Action**: 마지막에 *"디자인 변경(컴포넌트/페이지/widget 신설·수정) PR 은 `?template=web-component.md` 를 사용하세요"* 단일 줄 추가
- **Validate**: 본문 line count = 24 → 26 (footer + 빈 줄)

### Phase 2 — Pre-CI lint script + PR self-check 활성화

> **진입 게이트**: Phase 1 머지 + 신규 design plan 2건 작성 확인 후

#### Task 2.1 — `scripts/check-design-tokens.mjs` 신설
- **Action**: Node 24 ESM script. 3개 검사:
  1. **catalyst 신규 import** — `git diff --name-only` 의 `.tsx` 파일에서 `from ['"]@/shared/ui/catalyst/` import 검출 → baseline allowlist (기존 사용처) 와 대조 후 신규만 fail
  2. **inline `style=` 속성** — `style=\{\{` JSX 패턴 (단 `style={{ ['--x']: value }}` 의 *CSS custom property 주입* 패턴은 allowlist)
  3. **hardcoded color literal** — `#[0-9a-fA-F]{3,8}` / `rgb\(` / `oklch\(` 가 `.tsx`/`.css` (단 [tokens.css](../../services/web/src/shared/styles/tokens.css) 제외) 안에 등장 시 fail
- **Mirror**: [scripts/](../../scripts/) 디렉토리의 기존 `.mjs` 스크립트 (예: `extract-public-paths.mjs`) 의 shebang + ESM + 인자 처리 패턴
- **Validate**: 본 worktree 에서 `node scripts/check-design-tokens.mjs services/web/src` 가 *현재 catalyst 사용처는 통과 (allowlist), 임의 신규 위반 추가 시 fail*

#### Task 2.2 — `services/web/package.json` 의 `lint:design-tokens` script 추가
- **Action**: `scripts` 객체에 `"lint:design-tokens": "node ../../scripts/check-design-tokens.mjs src"` 한 줄 추가
- **Mirror**: 기존 `"lint": "eslint ."` 형식
- **Validate**: `npm --prefix services/web run lint:design-tokens` 가 exit code 0 (현재 baseline)

#### Task 2.3 — GitHub Actions CI 통합
- **Action**: 기존 web-lint workflow 가 있으면 step 추가 (`npm run lint:design-tokens`), 없으면 [.github/workflows/web-lint.yml](../../.github/workflows/web-lint.yml) 신설. `pull_request` trigger + `paths: ['services/web/**']`
- **Mirror**: 기존 `.github/workflows/` 안의 다른 workflow (예: `api-test.yml` 류) 의 trigger + setup-node + cache 패턴
- **Validate**: PR 생성 시 CI 가 `lint:design-tokens` step 을 실행 + 실패 시 PR 차단

### Phase 3 — code-reviewer agent + ESLint token allowlist

> **진입 게이트**: Phase 2 머지 + 측정 (false-positive ≤ 1건 / 2~3 design PR)

#### Task 3.1 — OQ2: `eslint-plugin-tailwindcss` × Tailwind 4 호환성 PoC
- **Action**: 본 worktree 안에서 (a) `npm --prefix services/web install -D eslint-plugin-tailwindcss` (b) `eslint.config.js` 에 추가 (c) `npm --prefix services/web run lint` 실행. 결과 3분기:
  - **PASS** — 그대로 채택, Task 3.3 진행
  - **PASS with warnings** — 호환성 issue 만 우회 (`@theme inline` 의 token 인식 등), 채택
  - **FAIL** — 대안 결정 PR: (a) custom ESLint flat rule 작성 (b) `lint:design-tokens` 확장 (c) Stylelint 로 분리
- **Mirror**: 없음 — 신규 PoC. 결과 메모는 PR 본문 + 본 plan 의 *Phase 3 후속 plan* 으로 분기
- **Validate**: `npm --prefix services/web run lint -- --debug` 출력 + decision memo (PR 본문)

#### Task 3.2 — `.claude/agents/web-design-reviewer.md` 신설 (project-local)
- **Action**: code-reviewer 형식 + frontmatter (name/description/tools). 본문은 *mobile-ui-guide §5.1.1 / §5.2.1 / §5.5 / §9 cross-check* 만 다룸. global code-reviewer 는 *patch 하지 않음* (OQ-N 결정)
- **Mirror**: `~/.claude/agents/code-reviewer.md` 의 frontmatter + 본문 구조. project-local 의 *FSD 슬라이스 + mobile-ui-guide* 인식만 추가
- **Validate**: `Task` tool 로 `subagent_type: web-design-reviewer` 가 활성화. 임의 디자인 변경 PR 에 대해 §9 5단계 cross-check report 출력

#### Task 3.3 — [services/web/eslint.config.js](../../services/web/eslint.config.js) patch
- **Action**: Task 3.1 결과에 따라 분기:
  - PASS 시 — `eslint-plugin-tailwindcss` 추가 + `classnames-order` / `no-arbitrary-value` rule 활성 + allowlist 에 mobile-ui-guide §6.2 token utility 추가
  - FAIL 시 — custom rule 또는 `lint:design-tokens` 확장
- **Mirror**: 기존 [eslint.config.js](../../services/web/eslint.config.js) 의 `defineConfig` + `extends:[...]` 형식
- **Validate**: `npm --prefix services/web run lint` 가 baseline 통과 + 임의 violation (예: `className="bg-[#3b82f6]"`) 추가 시 error

### Phase 4 — Vitest 페이지군 token snapshot

> **진입 게이트**: Phase 3 머지 + 페이지군 family 별 baseline 확보 (admin 제외)

#### Task 4.1 — 페이지군 token matcher util 신설
- **Action**: [services/web/src/__tests__/design-tokens/expectFamilyTokens.ts](../../services/web/src/__tests__/design-tokens/expectFamilyTokens.ts) 신설. `expectFamilyTokens(container, 'auth'|'drive'|'admin')` 형태 — render 결과의 className 집합이 family default token (mobile-ui-guide §5.5) 와 일치하는지 검증
- **Mirror**: 기존 [services/web/src/__tests__/](../../services/web/src/__tests__/) 의 mocks/setup 패턴 + `@testing-library/jest-dom` 의 matcher 패턴
- **Validate**: util 자체 unit test 통과 (mock container 로 family token assertion)

#### Task 4.2 — auth family snapshot baseline
- **Action**: [services/web/src/pages/login/ui/LoginPage.designtoken.test.tsx](../../services/web/src/pages/login/ui/LoginPage.designtoken.test.tsx) 신설. `render(<LoginPage/>)` + `expectFamilyTokens(container, 'auth')` + Vitest snapshot. 첫 실행으로 baseline 생성
- **Mirror**: [services/web/src/pages/drive/ui/DrivePage.test.tsx](../../services/web/src/pages/drive/ui/DrivePage.test.tsx) 의 render/setup
- **Validate**: `npm --prefix services/web run test -- LoginPage.designtoken` 통과 + snapshot 파일 commit

#### Task 4.3 — drive family snapshot baseline
- **Action**: [services/web/src/pages/drive/ui/DrivePage.designtoken.test.tsx](../../services/web/src/pages/drive/ui/DrivePage.designtoken.test.tsx) 신설. Task 4.2 와 동일 패턴, family `'drive'`
- **Validate**: 동일

#### Task 4.4 — admin family — deferred (PR 본문 인계)
- **Action**: PR 본문에 *"admin family snapshot 은 admin bootstrap 안정 후 별도 PR — foundations plan §Risks 와 일관"* 명시. 본 plan 은 admin 미터치
- **Validate**: 없음 (deferred)

## Validation

```bash
# Phase 1
ls -la .github/PULL_REQUEST_TEMPLATE/web-component.md
grep -E '^- \[ \] \*\*§(2\.2|6\.2|4\.1|2\.3|7\.3|5\.5|9)' .github/PULL_REQUEST_TEMPLATE/web-component.md | wc -l
# expect: 7

# Phase 2
node scripts/check-design-tokens.mjs services/web/src
# expect: baseline pass
npm --prefix services/web run lint:design-tokens
# expect: exit 0

# Phase 3
npm --prefix services/web run lint
# expect: baseline pass + violation injection 시 error

# Phase 4
npm --prefix services/web run test -- designtoken
# expect: snapshot 생성 + 회귀 시 fail
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 3 OQ2 PoC 가 FAIL — 대안 3개 중 결정 시간 ↑ | medium | medium | Phase 3 진입 게이트가 *Phase 2 머지 + 측정* 이므로 시간 buffer 가 있음. PoC 결과 자체를 별도 plan/PR 로 분기해 본 plan 의 Phase 4 진행을 차단하지 않음 |
| `scripts/check-design-tokens.mjs` 의 *false positive* 가 catalyst 사용처 baseline allowlist 오류로 분출 | medium | medium | Phase 2 의 첫 commit 은 *allowlist 만 생성 — fail mode 비활성*. 두 번째 commit 에서 fail mode on. 두 commit 분리로 baseline 검토 가능 |
| GitHub multiple PR template 의 `?template=web-component.md` 가 사용자가 *기억* 해야 작동 — 의도적으로 자동화 X | medium | low | Phase 1 의 footer 한 줄 + 본 worktree 의 PR 본문에서 *최초 1회* 시연 |
| project-local agent (`.claude/agents/web-design-reviewer.md`) 가 *글로벌 code-reviewer 와 동시 invoke* 시 중복 review | low | low | agent description 에 *"디자인 PR 만 invoke"* 명시. code-reviewer 와 cross-link 으로 역할 분리 |
| Phase 4 의 snapshot 이 *Phase 3 의 token allowlist 변경* 으로 mass 회귀 | medium | medium | Phase 4 는 Phase 3 *머지 후* 진입. baseline 생성 시점이 Phase 3 의 allowlist 와 동기 |
| Vitest snapshot 이 *jsdom 렌더링의 ResizeObserver / matchMedia 부재* 로 깨짐 | medium | low | [src/__tests__/setup.ts](../../services/web/src/__tests__/setup.ts) (있다면) 의 polyfill 확인. 없으면 Task 4.1 의 util 안에서 mock |
| 본 plan 머지 시 base v0.1 의 design-system-v1-headless-migration plan 과 *milestone 충돌* (PRD M2 한 슬롯에 두 plan 이 동시 진입) | low | medium | 본 plan 의 milestone 은 *enforcement* (M2 의 *4단 메커니즘*), headless plan 의 milestone 은 *headless 8개* (M2 의 *컴포넌트 마이그레이션*). PRD §Scope 에서 두 축이 분리됨을 plan 본문에 cross-link |

## 후속 작업 (PRD M3 인계)

- **PRD M3 — 신규 design PR 3건 dogfood 검증** (E1~E5 패턴 재현 0건)
  - 본 plan 의 Phase 1~4 머지 후 *측정 단계*. 별도 plan 불요 — PR template + agent + Vitest snapshot 이 자동으로 측정 수단 제공
  - PRD §Success Metrics 의 5개 지표 측정 결과 → 정책 보정 PRD 도출 (필요 시)

## Acceptance

- [ ] Phase 1 의 Task 1.1·1.2·1.3 완료 + 본 plan 머지
- [ ] PR template `?template=web-component.md` 가 GitHub 에서 정상 라우팅
- [ ] 본 PR 본문 자체가 web-component template + 디자인 self-check 7건 통과 (self-test)
- [ ] Phase 2~4 는 *후속 PR* 로 분리 — 본 plan 의 acceptance 범위 아님
- [ ] PRD §Risks "단계적 활성화" mitigation 이 본 plan 의 Phase 분리로 충족됨을 PR 본문에 cross-link

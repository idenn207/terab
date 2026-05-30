---
slug: design-system-v1-1-enforcement-review
target: .worktrees/design-system-v1-1-enforcement (브랜치 feat/design-system-v1-1-enforcement)
reviewed: 2026-05-30
reviewer: claude (Opus 4.7, /ecc:code-review local mode)
decision: APPROVE with comments
---

# Code Review — design-system v1.1 milestone 2 Phase 1 (enforcement seed)

## 요약

코드 변경 0건, markdown 5개 파일(2 modified + 3 untracked)만 다루는 정책/문서 PR. 보안 위험은 N/A 이고, plan 자체는 일관·실행 가능. **다만 후속 Phase 2 에서 *그대로 옮기면 실패하는 내부 모순 1건 (HIGH)* 과 mirror source 오기재 1건 (MEDIUM) 이 plan 본문에 박혀 있어, Phase 2 PR 작성 전에 plan 패치 필요.** 본 PR 자체(Phase 1)는 머지 가능.

## Files Reviewed

| File | Action | 비고 |
|---|---|---|
| `.claude/plans/README.md` | MODIFIED (+18) | "디자인 plan 작성 시" 섹션 신설 |
| `.claude/plans/design-system-v1-1-enforcement.plan.md` | UNTRACKED (+213) | 본 PR 의 주산물 (4 Phase plan) |
| `.claude/prds/design-system-v1-1-foundations.prd.md` | MODIFIED (+1/-1) | Milestone 2 status pending → in-progress |
| `.github/PULL_REQUEST_TEMPLATE.md` | MODIFIED (+2) | footer 1 줄 (web-component template 라우팅 안내) |
| `.github/PULL_REQUEST_TEMPLATE/web-component.md` | UNTRACKED (+49) | 디자인 변경 PR 전용 — design self-check 7건 강제 |
| `.claude/reports/design-system-v1-1-enforcement-report.md` | UNTRACKED (+88) | 구현 보고서 — Phase 1 acceptance self-test |

## Findings

### CRITICAL
None.

### HIGH

#### H1. Phase 2 의 `lint:design-tokens` script 인자가 plan 안에서 자기모순
- **위치**: [`design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) Phase 2 Task 2.2 (line 110) **vs** Files to Change 표 Phase 2 (line 62)
- **사실**:
  - line 62 (Files to Change): `"lint:design-tokens": "node ../../scripts/check-design-tokens.mjs services/web/src"`
  - line 110 (Task 2.2): `"lint:design-tokens": "node ../../scripts/check-design-tokens.mjs src"`
- **영향**: `npm run lint:design-tokens` 는 CWD = `services/web/` 에서 실행됨. line 62 의 `services/web/src` 는 *해당 CWD 기준* 으로 `services/web/services/web/src/` 로 풀려 *존재 X*. line 110 의 `src` 는 `services/web/src/` 로 풀려 의도 일치. Phase 2 PR 작성자가 표(line 62)를 먼저 참조하면 Task 2.1 의 `scripts/check-design-tokens.mjs` 가 *baseline 통과* 단계에서 "no files found" 로 false-pass — 즉 *enforcement 가 noop 으로 활성화* 됨. PRD §Risks 의 "false negative" 시나리오와 정확히 일치.
- **수정**: Phase 2 PR 진입 전, plan 의 line 62 도 `src` 로 통일 (또는 Task 2.2 와 일치하도록 표를 수정). 본 PR 본문 acceptance "Phase 2~4 는 후속 PR 로 분리" 이므로 본 PR 자체의 머지 차단은 아님 — 그러나 *plan 보정 commit 1건 추가 후 머지* 가 안전.

### MEDIUM

#### M1. "Patterns to Mirror" 의 `scripts/` mirror 출처 오기재
- **위치**: [`design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) line 40 (Patterns to Mirror 표의 "script 위치" row)
- **사실**: 표는 `[scripts/](../../scripts/)` 의 *기존 `.mjs` 스크립트* (예: `extract-public-paths.mjs`) 의 패턴을 mirror 한다고 명시. 실제 repo 구조:
  - `scripts/` (repo root) = shell scripts 만 (`setup-local.sh`, `setup.sh`, `stack-deploy.sh`, `wait-for-it.sh`, `worktree-bootstrap.sh`). `.mjs` 0건.
  - `extract-public-paths.mjs` 실제 위치 = `services/web/scripts/` (web 전용 빌드 스크립트).
- **영향**: Phase 2 의 Task 2.1 implementer 가 mirror 대상 파일을 찾기 위해 `ls scripts/*.mjs` 하면 hit 0 → "패턴 mirror 불가" 로 PoC 지연. 또한 *반대로* — 본 plan 이 `scripts/check-design-tokens.mjs` 를 repo root 에 둘지, `services/web/scripts/` 안에 둘지 *위치 결정 자체가 흔들림*: web 한정이면 web 스크립트 디렉토리가 자연, *모노레포 전반 (api/mq/web 모두 대상)* 이면 repo root.
- **수정 권장**: Phase 2 plan 보정 시 (a) mirror 출처를 `services/web/scripts/extract-public-paths.mjs` 로 정정 + (b) `scripts/check-design-tokens.mjs` 위치를 *repo root 유지* 인지 *web 스크립트 디렉토리* 인지 *명시적 결정* (현재 plan 은 후자를 mirror 한다면서 전자에 두는 모순).

#### M2. 신규 `.mjs` 파일의 EOL 정책이 plan 본문에서 미결정
- **위치**: [`design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) Phase 2 전반 (line 101 ~ 117)
- **사실**: CLAUDE.md 의 EOL 정책 — 기본 CRLF, *Linux 서버 직접 실행 / Docker 빌드 포함 / GitHub Actions 워크플로* 만 LF. `scripts/check-design-tokens.mjs` 는 (a) Windows dev 환경에서 `npm run lint:design-tokens` 로 실행 (b) CI Linux 에서도 동일 실행 — 둘 다 Node 가 직접 처리. hookify.enforce-crlf-default 정책 분기 어느 쪽도 명시 안 됨.
- **영향**: Phase 2 PR 의 `Write` 시 hookify.enforce-crlf-default 가 *기본 CRLF 변환 권장* 으로 분기 → Linux CI 에서 Node 가 shebang `#!/usr/bin/env node` 의 `\r` 을 OS 가 해석하지 못해 *"command not found"* 류 실패 가능. (Node 자체는 CRLF 본문은 OK 지만 shebang 줄은 OS exec 가 해석하므로 LF 필요.) shebang 미사용 + `node script.mjs` 형태 호출이면 무관.
- **수정 권장**: Phase 2 plan 의 Task 2.1 에 *"shebang 사용 X (호출은 `node ...` 명시) + 파일 EOL 은 CRLF 유지"* 또는 *"shebang 사용 + EOL LF (CLAUDE.md 의 Linux 실행 예외)"* 둘 중 결정 1줄 추가.

#### M3. Phase 3 Task 3.3 의 ESLint rule 이름이 실제 plugin API 와 일치하는지 미검증
- **위치**: [`design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) line 138 ("PASS 시 — `eslint-plugin-tailwindcss` 추가 + `classnames-order` / `no-arbitrary-value` rule 활성")
- **사실**: `eslint-plugin-tailwindcss` v3 의 공식 rule 표에 `tailwindcss/classnames-order` 는 존재. `tailwindcss/no-arbitrary-value` 는 *해당 plugin 공식 rule 목록에 부재* (arbitrary value 차단은 `no-custom-classname` 또는 별도 custom rule 영역). Phase 3 의 OQ2 PoC 가 본 사항을 surface 하긴 하지만 *plan 본문에 rule 이름이 박혀 있어 PoC 결정 시점에 인용 부담* 발생.
- **영향**: Phase 3 PR 작성 시 plan rule 이름 그대로 베끼면 ESLint config 가 *"unknown rule"* error 로 실패. 본 PR 머지는 차단 X (Phase 3 영역).
- **수정 권장**: Phase 3 plan 의 Task 3.3 PASS branch 에 *rule 이름은 PoC 검증 결과로 확정* 한 줄 추가. 현재 표기는 "예상 rule 이름" 으로 격하.

#### M4. Frontmatter 가 README 컨벤션과 불일치 (peer plans 와는 일치)
- **위치**: [`design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) line 1 ~ 9 vs [`.claude/plans/README.md`](../plans/README.md) line 30 ~ 36
- **사실**: README 명시 컨벤션:
  ```yaml
  name: kebab-slug-here
  description: 한 줄 요약 (검색용)
  status: pending | in-progress | done | archived
  created: YYYY-MM-DD
  ```
  본 plan frontmatter:
  ```yaml
  slug: design-system-v1-1-enforcement
  status: draft     # ← README enum 에 없는 값
  milestone: 2
  prd: ...
  worktree: ...
  branch: ...
  base: v0.1
  ```
  Peer ([`design-system-v1-1-foundations.plan.md`](../plans/design-system-v1-1-foundations.plan.md)) 도 동일하게 `slug`/`status: complete` 사용 — *peer 와는 일치, README 와는 불일치.*
- **영향**: 본 PR 만의 결함이 아닌 *peer 전반의 컨벤션 drift*. README 가 stale 이거나 — peer plans 가 README 보다 *더 풍부한* frontmatter (milestone/prd/worktree/branch/base) 를 사실상 채택 중. status enum 만은 `draft` 추가가 필요 (README 패치 대상).
- **수정 권장**: 본 PR 범위 밖. 별도 작은 PR 로 README 의 frontmatter 컨벤션을 peer 실태에 맞게 갱신 (또는 peer 들이 README 에 맞게 후행 패치) — 의사결정 필요.

### LOW

#### L1. PR template footer 의 query-string 링크가 실제 query 라우팅을 invoke 하지 않음
- **위치**: [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) line 25
- **사실**: 현재 footer:
  ```
  > 디자인 변경(컴포넌트/페이지/widget 신설·수정) PR 은 [`?template=web-component.md`](./PULL_REQUEST_TEMPLATE/web-component.md) 를 사용하세요.
  ```
  Link text 는 `?template=web-component.md` (query 모양) 이지만 link URL 은 `./PULL_REQUEST_TEMPLATE/web-component.md` (파일 자체). 사용자가 클릭하면 *템플릿 파일 preview* 만 열림 — GitHub 가 query 를 invoke 하지 않음. **GitHub multiple template 의 라우팅은 PR 생성 URL 에 query 가 붙어야** 작동 (`/compare/...?template=web-component.md`).
- **영향**: 실수 유발 가능성 — footer 가 *교육적* 라벨로는 OK 지만 *click-through 라우팅* 으로는 동작 안 함. PRD §Risks 의 "GitHub multiple PR template 의 사용자 *기억* 의존" 와 일관 (의도된 X).
- **수정 권장** (선택): 링크 텍스트와 URL 을 분리해 명시화 — `[gh pr create --template web-component.md](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/creating-a-pull-request-template) 또는 GitHub web 의 \`?template=web-component.md\` query` 류로 풀어 쓰기. 또는 현재 그대로 두되 *문구가 라우팅을 약속하지 않음* 을 명시.

#### L2. `.claude/plans/completed/` 가 README 에 미문서화
- **위치**: [`.claude/reports/design-system-v1-1-enforcement-report.md`](../reports/design-system-v1-1-enforcement-report.md) line 3 + line 87 의 "본 PR 머지 후 plan 을 `.claude/plans/completed/` 로 이전"
- **사실**: README 의 archive 정책 (line 45 ~ 50):
  > 완료(`done`) 후 **30일 경과** 시 `docs/archive/superpowers/{plans,specs}/` 로 이전
  
  `.claude/plans/completed/` 는 README 미언급. 실제 디렉토리는 존재 ([`completed/`](../plans/completed/) 에 `admin-login-twofa.plan.md` 등 5건). *de facto* 30일 전 "완료 직후" 임시 정착지로 운영 중인 듯.
- **영향**: 신규 contributor 가 README 만 읽고 archive 흐름 추정 시 `completed/` 단계를 모름. 단 본 PR 의 결함은 아님 — README 의 doc drift.
- **수정 권장** (별도 PR): README 의 archive 정책에 *"완료 직후 `.claude/plans/completed/` → 30일 후 `docs/archive/superpowers/`"* 2단계 명시.

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Plan §Validation grep (PR template 7 checkbox) | ✅ Pass | `^- \[ \] \*\*§(2\.2\|6\.2\|4\.1\|2\.3\|7\.3\|5\.5\|9)` count = 7 |
| Plan §Validation 헤딩 grep (README design 섹션) | ✅ Pass | `^## 디자인 plan` hit |
| Plan §Validation 파일 존재 (`web-component.md`) | ✅ Pass | 2399 bytes |
| Build / Type check / Unit test | N/A | 코드 변경 0건 — markdown 전용 |
| 보안 검사 (hardcoded secret / SQL / XSS) | N/A | markdown 전용 |
| CRLF 확인 (3 새 파일) | ✅ Pass | 보고서의 perl 변환 후 |
| Mirror 출처 사실 검증 | ⚠️ M1 | `scripts/*.mjs` repo root 에 부재 — `services/web/scripts/extract-public-paths.mjs` 가 실제 위치 |

## Decision

**APPROVE with comments** — 본 PR 자체 (Phase 1 — markdown 5개) 는 머지 가능. *Phase 2 PR 작성 직전* H1·M1·M2 를 plan 본문에 보정 commit 1건으로 흡수 권장. Phase 3 의 M3, 컨벤션 drift 의 M4·L2 는 별도 PR.

## Cross-check vs PR template self-check (acceptance self-test)

본 PR 본문이 *web-component template + design self-check 7건* 으로 작성될 예정 (plan §Acceptance) — 그러나 본 PR 의 변경은 *컴포넌트 코드 0건* (markdown 정책 파일만). 따라서 §2.2/§6.2/§4.1/§2.3/§7.3/§5.5 6건은 *N/A* 라고 명시하고, §9 의 5단계만 *"본 PR 은 정책 seed 이며 컴포넌트 단계가 아님"* 메모로 통과시키는 것이 자연. **PR 본문 acceptance 의 self-test 는 *template 라우팅 동작* + *checkbox 7건 노출* 검증으로 충분** — 모든 항목 ✓ 강제는 plan 의 의도 아님 (web-component template 자체가 component-level PR 대상).

## 권장 후속 액션

1. (선택) Phase 1 본 PR 머지 전 H1 보정 commit 1건 — plan line 62 의 인자를 `src` 로 통일.
2. (필수) Phase 2 PR 작성 시 M1·M2 결정을 plan 보정 + commit 본문에 cross-link.
3. (별도 PR) M4·L2 — README frontmatter 컨벤션 + archive `completed/` 단계 명시.
4. (Phase 3 진입 직전) M3 — rule 이름을 PoC 결과 확정으로 plan 본문 보정.

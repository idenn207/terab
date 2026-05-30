# 구현 보고서: design-system v1.1 milestone 2 — 4단 cross-check 강제 메커니즘 (Phase 1)

- **Plan**: [`.claude/plans/design-system-v1-1-enforcement.plan.md`](../plans/design-system-v1-1-enforcement.plan.md) → 본 PR 머지 후 `.claude/plans/completed/` 로 이전
- **Worktree**: `.worktrees/design-system-v1-1-enforcement/`
- **Branch**: `feat/design-system-v1-1-enforcement` (base: `v0.1`)
- **PRD**: [`.claude/prds/design-system-v1-1-foundations.prd.md`](../prds/design-system-v1-1-foundations.prd.md) (Milestone 2)
- **본 PR 범위**: Phase 1 만 — plan checklist + PR template seed. Phase 2 ~ 4 는 *후속 PR* 로 분기 (PRD §Risks "단계적 활성화" mitigation 과 일관).

## 요약

PRD §Scope "강제 메커니즘 4단" 표의 *Stage 1 (Plan 단계)* 산출을 도입했다. 신규 design plan 은 mobile-ui-guide.md §5.1.1 / §5.2.1 / §5.5 / §9 를 *본문 인용* 의무로 가지고 (Task 1.1), 신규 design PR 은 GitHub multiple template 의 `?template=web-component.md` 로 라우팅돼 7건의 design self-check 를 본문에 강제로 노출한다 (Task 1.2 + 1.3). Stage 2 ~ 4 (pre-CI lint script / ESLint allowlist / Vitest snapshot) 는 *진입 게이트* — 본 PR 머지 + 신규 design plan 2건 작성 후 측정해 후속 PR 로 진행한다.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (Phase 1 만 보면 Small) | Small — markdown 3개 파일 |
| Files Changed | 3 (1 update + 1 create + 1 update) | 3 (정확히 일치) |
| 코드 변경 | 0 | 0 |
| Phase 1 acceptance | Task 1.1 + 1.2 + 1.3 + 본 plan 머지 | Task 1.1 + 1.2 + 1.3 완료. 머지는 PR 작성 후 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | `.claude/plans/README.md` — design plan 인용 의무 추가 | ✅ Complete | `## 디자인 plan 작성 시` 섹션 신설, §5.1.1·§5.2.1·§5.5·§9 anchor 4개 표 + web-component template 라우팅 안내 footer |
| 1.2 | `.github/PULL_REQUEST_TEMPLATE/web-component.md` 신설 | ✅ Complete | 기존 PR template 의 5섹션 + `## 디자인 self-check` 단일 섹션 (체크박스 7건) + §9 Atomic 5단계 sub-bullet |
| 1.3 | `.github/PULL_REQUEST_TEMPLATE.md` footer 한 줄 추가 | ✅ Complete | `## 참고 사항` 아래에 `?template=web-component.md` 라우팅 quote 1줄 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Plan §Validation grep | ✅ Pass | `^- \[ \] \*\*§(2\.2\|6\.2\|4\.1\|2\.3\|7\.3\|5\.5\|9)` count = 7 (정확히 일치) |
| Plan §Validation 헤딩 grep | ✅ Pass | `^## 디자인 plan` hit |
| Plan §Validation 파일 존재 | ✅ Pass | `.github/PULL_REQUEST_TEMPLATE/web-component.md` 2399 bytes |
| EOL 정책 (CRLF) | ✅ Pass | 3 파일 모두 CRLF (perl -i -pe 변환 1회 필요) |
| markdownlint (IDE diagnostics) | ✅ Pass | MD028 1건 발견 → 두 blockquote 사이 빈 줄 제거하여 해소 |
| Type-check / Unit test / Build | N/A | 코드 변경 0건 — markdown 전용 |
| PR 라우팅 동작 검증 | ⏸️ Deferred | PR 작성 시점에 GitHub 가 `?template=web-component.md` query 인식 확인 — acceptance 의 self-test |

## Files Changed

| File | Action | Lines | Notes |
|---|---|---|---|
| `.claude/plans/README.md` | UPDATED | +18 | `## 디자인 plan 작성 시` 섹션 + 4 anchor 표 + 라우팅 안내 |
| `.github/PULL_REQUEST_TEMPLATE.md` | UPDATED | +2 | `## 참고 사항` 아래 footer 1 줄 (+ 분리 빈 줄) |
| `.github/PULL_REQUEST_TEMPLATE/web-component.md` | CREATED | +49 | 5섹션 (요약/변경 내용/변경 유형/테스트/참고 사항) + `## 디자인 self-check` (체크박스 7건 + §9 5-bullet) |

## Deviations from Plan

| 항목 | Plan 명세 | 실제 | 사유 |
|---|---|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` 라인 수 | 24 → 26 (footer + 빈 줄) | 23 → 25 (`wc -l` 기준) | Plan 은 Read 표시 라인 수를 인용, `wc -l` 은 `\n` 카운트 — 의도(footer + 빈 줄) 충족, 수치만 측정법 차이 |
| README 의 footer 단락 | 두 번째 blockquote | 일반 단락으로 변환 | markdownlint MD028 (consecutive blockquotes with blank line) 회피 — 두 quote 사이를 일반 단락으로 분리 |

## Issues Encountered

| 이슈 | 해결 |
|---|---|
| `Write` 직후 파일이 LF EOL 로 저장 — 프로젝트 정책 CRLF 위반 | `perl -i -pe 's/\r?\n/\r\n/g'` 로 in-place 변환, `file` 명령으로 검증 |
| GateGuard hook 이 매 Edit/Write 직전 사실 확인 요구 | 3회 모두 Grep/Glob 으로 의존성 확인 후 사실 4건 제시 → 정상 진행 |
| README 의 두 연속 blockquote 가 MD028 트리거 | 두 번째를 일반 단락으로 변환 (의미 손실 없음 — 라우팅 안내는 callout 강조 불필요) |

## Review Feedback Applied (post-review)

[`design-system-v1-1-enforcement-review.md`](../reviews/design-system-v1-1-enforcement-review.md) 의 권장 후속 액션 1번 흡수.

- **H1 — Phase 2 `lint:design-tokens` script 인자 자기모순 (line 62 vs line 110)**
  - **위치**: plan §"Files to Change" 표의 Phase 2 row
  - **보정**: line 62 의 인자를 `services/web/src` → `src` 로 통일 + "(CWD = `services/web/` 기준 상대 경로 — Task 2.2 와 동일)" 한 줄 명시
  - **근거**: `npm run lint:design-tokens` 의 CWD = `services/web/` — 인자 `services/web/src` 는 `services/web/services/web/src/` 로 풀려 *존재하지 않는 경로* → "스캔 파일 0건" 의 noop pass. PRD §Risks 의 false negative 시나리오 일치

> M1·M2 (Phase 2 mirror 출처·`.mjs` EOL 정책) 와 M3 (Phase 3 ESLint rule 이름) 는 본 PR 범위 밖 — *Phase 2/3 진입 PR 작성 시점* 에 동일한 plan 보정 commit 으로 흡수 예정 (리뷰 §"권장 후속 액션" 2 ~ 4번).

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| N/A | 0 | 본 PR 은 markdown 전용 — 단위 테스트 대상 코드 없음. Phase 4 (별도 PR) 에서 Vitest snapshot 도입 예정 |

## 후속 단계 (별도 PR)

PRD §Scope "강제 메커니즘 4단" 의 나머지 3단:

- **Phase 2** — `scripts/check-design-tokens.mjs` + `lint:design-tokens` npm script + GitHub Actions CI 통합. 진입 게이트: 본 PR 머지 + 신규 design plan 2건 작성 후
- **Phase 3** — `.claude/agents/web-design-reviewer.md` (project-local) + `services/web/eslint.config.js` token allowlist patch. 진입 게이트: Phase 2 머지 + 측정 (false-positive ≤ 1건 / 2~3 design PR). Phase 3 첫 task 는 OQ2 (`eslint-plugin-tailwindcss` × Tailwind 4 호환성) PoC
- **Phase 4** — `src/pages/{auth,drive}/ui/*.designtoken.test.tsx` Vitest snapshot baseline. admin family 는 admin bootstrap 안정 후 별도 PR (foundations plan §Risks 와 일관)

각 Phase 의 *진입 게이트* 는 본 plan 의 "단계적 활성화" 정책 — false-positive 측정 단계를 거치지 않고 다음 단계로 진입하지 않는다.

## Next Steps

- [ ] `/code-review` 로 변경 리뷰 (markdown 전용이라 일반 code-review 보다 *PR template wording* 검토에 가까움)
- [ ] `git add .github/PULL_REQUEST_TEMPLATE.md .github/PULL_REQUEST_TEMPLATE/web-component.md .claude/plans/README.md .claude/plans/design-system-v1-1-enforcement.plan.md .claude/reports/design-system-v1-1-enforcement-report.md` + commit
- [ ] PRD (`.claude/prds/design-system-v1-1-foundations.prd.md`) 변경분이 같은 PR 에 포함될지 사용자 결정 — 현재 modified 상태 (이전 세션 작업)
- [ ] `/ecc:pr` 로 PR 생성 — *본 PR 의 본문 자체가 web-component template + 디자인 self-check 7건 통과* (acceptance 의 self-test)
- [ ] PR 머지 후 plan 을 `.claude/plans/completed/` 로 이전 (`git mv`)

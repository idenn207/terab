---
name: services-web-usecase-test-coverage
description: services/web 의 use-case 훅 6개 (테스트 누락분) 에 단위 테스트 추가하여 ECC 80% 커버리지 기준 달성 + codegen migration 류 회귀의 자동 감지 기반 확보
status: done
created: 2026-05-25
completed: 2026-05-25
---

# PRD: services/web use-case 테스트 커버리지

## Problem

`services/web` 의 features 슬라이스가 보유한 **use-case 훅 12 개 중 7 개만 테스트 존재** (커버리지 58%, ECC `common/testing.md` 의 80 % 기준 미달). 누락 use-case 는 다음 6 개다.

| # | 슬라이스 / 훅 | 도메인 |
|---|---|---|
| 1 | [`backup-code/useBackupCode`](../../services/web/src/features/backup-code/model/useBackupCode.ts) | 인증 — 2FA 복구 코드 |
| 2 | [`login-by-2fa/useBackupLogin`](../../services/web/src/features/login-by-2fa/model/useBackupLogin.ts) | 인증 — 백업 코드 로그인 |
| 3 | [`login-by-2fa/useTwoFactorRespond`](../../services/web/src/features/login-by-2fa/model/useTwoFactorRespond.ts) | 인증 — 2FA 챌린지 응답 |
| 4 | [`logout/useLogout`](../../services/web/src/features/logout/model/useLogout.ts) | 인증 — 로그아웃 |
| 5 | [`register-by-invitation/useInvitationValidation`](../../services/web/src/features/register-by-invitation/model/useInvitationValidation.ts) | 회원가입 — 초대 토큰 검증 |
| 6 | [`trusted-device/useTrustedDevice`](../../services/web/src/features/trusted-device/model/useTrustedDevice.ts) | 신뢰기기 등록/해제 |

이 격차는 단순 수치 미달 이상의 위험을 동반한다. ts-rest → Swagger/hey-api 마이그레이션(PR #37, 커밋 `0e67cb8`) 직후 `useTwoFactorPolling.test.tsx` 가 MSW mock URL 미갱신으로 회귀했고, 테스트가 없던 6 개 훅은 같은 시점에 회귀가 있었더라도 **감지 자체가 불가능**했다. 즉 누락은 코드 품질의 안전망뿐 아니라 **codegen 종속성 변경 시의 회귀 감지** 도 함께 잃는다.

## Hypothesis

6 개 누락 use-case 에 단위 테스트를 추가하면:

1. `services/web` features 의 use-case 커버리지가 12/12 (100 %) — 슬라이스 단위로는 `ECC common/testing.md` 의 80 % 기준 충족
2. codegen 갱신·라우팅 변경·인증 store 시그니처 변경 같은 cross-cutting 회귀를 **자동 감지** 가능
3. use-case 별 시나리오 (성공·실패·error fallback) 가 PRD 의 acceptance 조건으로 박제되어, 향후 수정 시 의도 보존이 강제됨

## Scope

### In Scope

- 6 개 누락 use-case 의 단위 테스트 신설 (`*.test.tsx`)
- 각 use-case 별 **3-5 개 시나리오** 커버 (성공/실패/edge case)
- 필요 시 MSW handler 추가 (글로벌 `handlers.ts` 가 아닌 테스트별 `server.use(...)`)
- TanStack Query / Zustand / react-router 의존성은 `__tests__/wrappers.tsx` 의 `makeRouterWrapper()` 재사용
- `services/web` 테스트 명령으로 6 개 신규 spec 전부 통과 검증

### Out of Scope

- `useTwoFactorPolling.test.tsx` 의 사전 실패 fix (별도 PR: `fix/test-2fa-polling-msw-url` 권장 — 본 PRD 의 acceptance 와 충돌 회피)
- entities/stores 단위 테스트 (별도 PRD 권장)
- widgets/pages 통합 테스트 (별도 PRD 권장)
- E2E (Playwright) 시나리오 — `services/web/e2e/` 자체 부재, 별도 PRD
- production 코드 변경 — 본 PRD 는 테스트 추가만 (단, MSW handler 시그니처 수정 등 사소한 spec 인프라 변경은 허용)
- 커버리지 측정 도구 도입 (현재 `npm test`만 사용. `vitest --coverage` 인프라는 별도 PRD)

## Glossary

| 한글 | 영문 (코드) | 정의 |
|---|---|---|
| use-case 훅 | use-case hook | features 슬라이스의 `model/use*.ts` — 하나의 사용자 행위 흐름을 캡슐화한 React hook |
| 시나리오 | scenario | 단일 `it(...)` 블록 — 1 행위/입력 → 1 expected outcome |
| 회귀 감지 | regression detection | codegen·라우팅·store 변경 후 테스트로 의도 위반을 즉시 발견하는 능력 |

도메인 용어는 마스터 `CLAUDE.md` 의 표를 그대로 승계 (User/File/Folder/Drive/Permission/Role/Share).

## Acceptance

- [ ] 6 개 use-case 모두 `*.test.tsx` 신설
- [ ] 각 spec ≥ 3 시나리오 (총 ≥ 18 시나리오)
- [ ] `npm --prefix services/web test -- --run` 전체 통과 (사전 실패 `useTwoFactorPolling.test.tsx` 는 별도 PR 의존성이므로 본 PRD 의 통과 기준에서 제외 — 별도 PR 머지 후 합산)
- [ ] services/web features 의 use-case 커버리지 12/12 (100 %)
- [ ] 회귀 시나리오 박제: 각 spec 의 첫 번째 시나리오는 "happy path" (성공 + 라우팅/상태 부수효과 검증) 형태
- [ ] 모든 신규 .tsx 파일이 CRLF
- [ ] 본 PRD `status: done` 전이

## Delivery Milestones

| # | Workstream | Status | Plan | Priority |
|---|---|---|---|---|
| 1 | use-case 6 개 단위 테스트 신설 | done | [.claude/plans/services-web-usecase-test-coverage.plan.md](../plans/services-web-usecase-test-coverage.plan.md) | High |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| codegen 의 path / baseURL 미스매치 (useTwoFactorPolling 과 같은 류) | High | 각 test 작성 전 `services/web/src/shared/api/generated/sdk.gen.ts` 에서 실제 URL 확인 + axios baseURL 합산. baseline grep 명령을 plan validation 에 포함 |
| MSW handler 의 path matching 실패 시 silent fail (data=undefined → 빈 fallback) | High | 각 test 에 "data 가 모킹대로 반환됨" 명시 assertion 추가 (옵션값/응답값 비교) |
| `useUserStore` 의 store mock 누락으로 setAuth/clearAuth 검증 곤란 | Medium | `wrappers.tsx` 에 store reset 헬퍼 추가 또는 각 test 의 `beforeEach` 에서 `useUserStore.getState().clearAuth()` |
| `window.confirm` 의존 (useBackupCode) — JSDOM 에 default 동작 없음 | Low | `vi.spyOn(window, 'confirm').mockReturnValue(true / false)` 시나리오별 분기 |
| navigate 부수효과 검증 — `useNavigate()` mock 필요 | Medium | `vi.mock('react-router-dom', ...)` 또는 `MemoryRouter` 의 location state 변화 assertion. 후자가 wrapper 와 일관 |
| `vi.useFakeTimers` 와 TanStack Query 의 polling 조합 deadlock 가능성 | Medium | 각 test 에서 fake timer 사용은 polling 흐름(useTwoFactorPolling 류)에 한정, mutation-only 훅은 real timer 사용 |
| 회귀 자동 감지 가설이 실패 (즉 새 회귀가 발생해도 spec 이 못 잡음) | Medium | spec 의 첫 시나리오는 "codegen 실제 URL 로 호출되는지" 까지 검증 — MSW handler 가 hit 되었는지 assertion |
| PR 충돌 — services/web 의 진행 중 기능 PR | Medium | 신규 test 만 추가 + production 코드 무수정 정책으로 충돌 면적 최소화. 슬라이스 단위 PR 분리 가능 |

## References

- ECC 테스트 룰: [.claude/rules/ecc/common/testing.md](../rules/ecc/common/testing.md), [.claude/rules/ecc/typescript/testing.md](../rules/ecc/typescript/testing.md), [.claude/rules/ecc/web/fsd.md](../rules/ecc/web/fsd.md)
- services/web 컨벤션: [services/web/CLAUDE.md §"테스트 파일 위치"](../../services/web/CLAUDE.md)
- 테스트 인프라: [services/web/src/__tests__/](../../services/web/src/__tests__/) — `wrappers.tsx`, `mocks/`
- 회귀 사례 evidence: [docs/audits/code-pattern-audit-2026-05.md](../../docs/audits/code-pattern-audit-2026-05.md) (use-case 테스트 부재로 회귀 감지 실패의 간접 증거)
- 마스터 PRD (선행): [.claude/prds/superpowers-to-ecc-migration.prd.md](superpowers-to-ecc-migration.prd.md) (워크스트림 4 종결 → 본 PRD 가 후속 격차 해소)

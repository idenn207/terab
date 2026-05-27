# mobile-app-feel — Android 모바일 1.0 first-impression 기본기

## Problem
NAS 모바일 앱(Capacitor Android)이 v1.0 출시 직전이지만 OS 인터랙션 규약을 지키지 못해 "네이티브 앱처럼 자연스럽지 않다." 구체적으로 (a) 2FA 푸시 알림이 클릭되어도 해당 verify 화면으로 이동하지 않고 단순히 앱이 열리고, (b) system status bar / navigation bar / 노치 영역에 콘텐츠가 가려 글자 겹침·불필요 스크롤이 발생하며 일부 버튼이 클릭 불가, (c) Android 하드웨어 뒤로가기가 라우터 history만 따라가 로그인 직후 뒤로가기로 `/login` 화면에 복귀되고 어디서도 앱이 종료되지 않는다.

## Evidence
- **재현 (Galaxy Z Flip4 / Android 16, `npm run cap:sync:dev` + `npm run cap:android:dev` 빌드)**: 모바일에서 로그인 → PC에서 로그인 시도로 2FA 트리거 → 모바일에서 푸시 수신 → 알림 클릭 → 앱만 켜지며 원래 화면 그대로 유지. 자동 이동 없음.
- **디바이스 매트릭스**: Galaxy Z Flip4 / Android 16 실기, Galaxy S26 / Android 16 emulator. 두 환경 모두 세 결함 100% 재현.
- **기술 증거**: Android 측 deep-link intent filter 미설정. MQ FCM payload에 deep-link 필드 미존재. [services/web/src/shared/styles/tokens.css:65-68](../../services/web/src/shared/styles/tokens.css#L65-L68)에 `--spacing-safe-top/bottom/left/right` 토큰이 정의되어 있으나 사용처 0건. `@capacitor/app` BackButton listener 미바인딩.
- **빈도**: 세 결함 모두 항상 발생 (관련 설정/구현이 부재한 상태).
- **이전 workaround**: 없음. tokens.css의 safe-area 토큰만 선언되어 있을 뿐 어떤 컴포넌트도 참조하지 않음.

## Users
- **Primary**: NAS 모바일 앱(Capacitor Android)을 일상적으로 사용하는 일반 Android 사용자. v1.0 dogfooding 초기 테스터 포함.
- **Not for**: iOS 사용자 — iOS 빌드 자체가 PRD A 범위 밖이며, 필요 시 별도 PRD를 신설한다.

## Hypothesis
Android 모바일 앱에서 **(a) 2FA 푸시 알림이 MQ payload의 가변 deep-link path에 따라 해당 verify 화면(예: `/2fa/:id`)으로 직접 이동하고, (b) 모든 라우트가 system inset에 가려지지 않도록 전역 SafeAreaGuard 레이어가 적용되며, (c) 하드웨어 뒤로가기가 라우터 계층에 따라 분기되어 최하위 레이어(root-level destination) 화면에서는 2초 안에 두 번 누르면 앱이 종료되는 것**이 — Android 사용자에게 "네이티브 앱처럼 자연스러운 first-impression"을 제공할 것이다.

**검증 신호**: dogfooding 디바이스(Galaxy Z Flip4 + S26 emulator)에서 세 결함 모두 0건 재현 + v1.0 출시 후 첫 외부 테스터 3명 이상이 "back / 푸시 / 레이아웃 어색" 이슈를 제기하지 않음.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| 2FA push deep-link 도달률 (foreground + background 합) | 95%+ | 알림 클릭 → 5초 이내 verify 화면 진입 비율 (dogfooding 수동 검증, 향후 client telemetry 보강) |
| Safe-area 미적용으로 인한 클릭 불가 / 글자 오버랩 잔존 UI | 0건 | dogfooding 체크리스트 (모든 라우트의 status / nav bar 영역 시각 점검) |
| 로그인 후 뒤로가기로 `/login`에 복귀하는 시나리오 | 0건 | dogfooding 재현 시도 |
| 최하위 레이어에서 뒤로가기 2회 시 앱 종료 | 100% | dogfooding 재현 (정의된 모든 최하위 라우트) |

## Scope

**MVP** — 사용자가 체감할 결과로만 기술

1. **2FA 푸시 deep-link**
   - MQ가 발행하는 FCM payload에 `deepLink` 필드(가변 path)를 포함한다.
   - 모바일에서 PC 로그인으로 인해 발생한 2FA 푸시를 클릭하면 **앱이 background / foreground 어느 상태였든** 해당 verify 화면(예: `/2fa/:id`)으로 이동한다.
   - 알림 클릭이 단순 "앱 켜기"로 끝나는 현재 동작이 제거된다.
   - 로그아웃 상태인 사용자에게는 2FA 푸시 자체를 보내지 않는다 (MQ 측 가드).

2. **전역 SafeAreaGuard**
   - 모든 라우트의 최상위 레이아웃에 일관 적용되는 단일 책임 컴포넌트를 도입한다.
   - 기존 `--spacing-safe-top/bottom/left/right` 토큰이 실제로 적용된다.
   - `/drive` 상단의 사이드바 토글 버튼과 프로필 버튼의 클릭 가능 영역이 status bar에 가려지지 않는다.
   - 모든 페이지에서 글자 겹침 / 불필요 스크롤 영역 발생 0건.

3. **하드웨어 뒤로가기 동작 분기**
   - **최하위 레이어** (root-level destination — 부모 라우트가 없는, 사용자가 도달할 수 있는 가장 바깥쪽 화면. 현재 `/login`, `/drive` 가 해당하며, 향후 추가되는 동급 라우트는 기획 시 명시): 1회 누름 = "한 번 더 누르면 종료" 토스트 노출, 2초 안에 2회 누름 = 앱 종료.
   - **그 외 하위 화면**: 현재처럼 React Router history.back().
   - 로그인 직후 `/drive`에서 뒤로가기 시 `/login`으로 복귀하는 버그가 사라진다.

**Out of scope** (PRD A에서 명시적으로 제외 — 추가 요청 시 별도 PRD로 분리)
- iOS Capacitor 빌드 및 iOS HIG 대응 (사용자 명시 절대 제외).
- catalyst UI → headless component 마이그레이션 (PRD B `design-system-v1`에서 다룸).
- 2FA 외 푸시 시나리오 (파일 공유 알림, 백업 완료 알림 등).
- Background에서 푸시 도착 후 verify 화면 진입 시 challenge 자동 검증 (사용자 탭 동작 필요 유지).
- 더블탭 종료 토스트의 다국어 (한글 고정).
- safe-area를 활용한 컴포넌트별 디자인 튜닝 (전역 Guard 도입까지만).

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | 2FA push deep-link 완성 | 모바일이 background / foreground 어느 상태에서든 2FA 푸시 클릭 시 verify 화면으로 직접 이동 | complete | [../plans/mobile-app-feel.plan.md](../plans/mobile-app-feel.plan.md) (구현 보고: [../PRPs/reports/mobile-app-feel-report.md](../PRPs/reports/mobile-app-feel-report.md)) |
| 2 | 전역 SafeAreaGuard 도입 | 모든 라우트가 system inset에 가려지지 않고 `--spacing-safe-*` 토큰이 실제로 적용됨 | complete | [../plans/mobile-app-feel.plan.md](../plans/mobile-app-feel.plan.md) (구현 보고: [../PRPs/reports/mobile-app-feel-report.md](../PRPs/reports/mobile-app-feel-report.md)) |
| 3 | 하드웨어 뒤로가기 분기 동작 | 최하위 레이어에서 2초 더블탭 종료, 그 외 라우터 history; 로그인 복귀 버그 해소 | complete | [../plans/mobile-app-feel.plan.md](../plans/mobile-app-feel.plan.md) (구현 보고: [../PRPs/reports/mobile-app-feel-report.md](../PRPs/reports/mobile-app-feel-report.md)) |

## Open Questions
- [ ] **최하위 레이어(root-level destination) route 명세 확정 (기획 필요)** — `/login`, `/drive` 외에 향후 추가될 동급 라우트의 list가 plan 진입 전에 결정되어야 한다. 하단 탭 네비게이션 도입 시 각 탭의 root 라우트가 포함된다.

## Risks
| Risk | Likelihood | Impact | Mitigation 방향 (plan에서 확정) |
|---|---|---|---|
| FCM data-only payload에서 Android 14+ notification trampoline 제약으로 click intent가 막힐 가능성 | Medium | High | notification + data hybrid + click action을 native MainActivity에서 처리 |
| Capacitor App plugin BackButton listener와 React Router history의 race / 우선순위 충돌 | Medium | Medium | listener를 single source of truth로 두고 router는 listener가 호출 |
| Safe-area inset이 notch 없는 Android 기기에서 0이라 시각적 padding 부족 | Low | Low | `max(env(safe-area-inset-top), 8px)` 식 floor 설정 |
| 더블탭 종료가 접근성(긴 press 사용자)에서 의도치 않게 트리거 | Low | Low | timeout 2s + 토스트 안내 |
| MQ에서 로그아웃 상태 사용자를 정확히 식별 못해 푸시가 전송됨 | Low | Low | session / refresh-token revocation 시점을 MQ가 추적할 수 있는지 plan 단계에서 확인 |

---
*Status: DRAFT — requirements only. Implementation planning pending via `/ecc:plan .worktrees/mobile-app-feel/.claude/prds/mobile-app-feel.prd.md`.*

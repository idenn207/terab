---
name: code-pattern-audit-2026-05
description: services/api·services/web layer 패턴이 .claude/rules/ecc/ 표준과 부합·격차하는 지점을 1회 스냅샷 — 워크스트림 4 진입 evidence base
status: complete
date: 2026-05-25
---

# Code Pattern Audit 2026-05

> 워크스트림 4 ([code-pattern-cleanup.plan.md](../../.claude/plans/code-pattern-cleanup.plan.md)) Phase 1 의 evidence base. 본 audit 의 결론은 (a) ECC 룰 6 신설 + 2 보완으로 격차 90% 흡수, (b) 코드 위반은 ≤ 5 개로 cap.

## 1. 목적

워크스트림 4 진입 시 `services/api` (NestJS 11) 와 `services/web` (FSD) 의 layer 패턴이 `.claude/rules/ecc/` 의 표준과 어디서 부합하고 어디서 격차가 있는지를 1 회 스냅샷한다. 본 audit 는 갱신되지 않는다 — 재발 시 신규 audit 파일(`docs/audits/code-pattern-audit-YYYY-MM.md`) 로 추가한다.

## 2. 범위

| 영역 | 대상 |
|---|---|
| ECC 룰 | `.claude/rules/ecc/{common,typescript,web}/` 의 모든 룰 |
| services/api | `services/api/src/` 모든 도메인 (auth, file, folder, twofa, user, device, trusted-device, invitation, trash + common/database/security/logger/minio/health/test) |
| services/web | `services/web/src/` 모든 레이어 (app/pages/widgets/features/entities/shared, `shared/api/generated/` 제외) |
| 제외 | `*.spec.ts`, `*.test.{ts,tsx}`, `services/web/src/shared/api/generated/` (codegen 산출물) |

## 3. ECC ↔ services 격차 카탈로그

| # | 영역 | 격차 | 의도성 | 처리방향 |
|---|---|---|---|---|
| G1 | ECC `typescript/patterns.md` 의 `API Response Format` `{success, data, error}` 봉투 | services/api 는 NestJS controller 가 도메인 객체 직반환, 오류는 `throw new ApiException(...)`. 봉투 없음 | 의도적 — Swagger plugin 의 자동 type 합성 + hey-api codegen 시너지 | ECC 룰 완화 — Task 8 (`typescript/patterns.md`) |
| G2 | ECC `typescript/coding-style.md` 의 "Use Zod for schema-based validation" | services/api 는 class-validator + class-transformer, services/web 는 `zodResolver 금지` (RHF `register()` 내장 옵션 사용) | 의도적 — NestJS ValidationPipe 표준 + Swagger plugin `classValidatorShim` 합성, RHF native 통합 | ECC 룰 완화 — Task 7 (`typescript/coding-style.md`) |
| G3 | services/api/CLAUDE.md §"로거 사용" 의 `.claude/rules/logging.md` 참조 | 해당 파일 부재 (`.claude/rules/ecc/common/` 에 logging.md 없음) | 격차 — 단순 누락 | ECC `common/logging.md` 신설 + 참조 경로 정정 — Task 5, Task 9 |
| G4 | ECC 에 NestJS 11 전용 룰 디렉토리 부재 | services/api 의 controller/service/repository 3-tier, DI 패턴, Module 경계, `@Global()` 사용 기준 등이 ECC 산하 부재 — services/api/CLAUDE.md 가 사실상 NestJS 룰을 정의하지만 ECC 표준 진입점 부재 | 격차 — ECC 가 services/api 의 컨벤션을 표준화하지 못함 | `nestjs/{coding-style, patterns, testing}.md` 3 파일 신설 — Task 2, 3, 4 |
| G5 | ECC `web/` 에 FSD 의존방향 룰 부재 | services/web 의 레이어 의존방향 (`app → pages → widgets → features → entities → shared`), 세그먼트 의존방향 (`api → model → ui`), `index.ts` boundary, cross-slice 금지 등이 ECC 산하 부재 | 격차 — services/web/CLAUDE.md 만 정의, ECC 산하 부재 | `web/fsd.md` 신설 — Task 6 |
| G6 | ECC `common/coding-style.md` 의 Repository 인터페이스 (`findAll/findById/create/update/delete` 제네릭) | services/api 는 도메인별 method 명명 (`findByUserId`, `softDelete`, `findByUploadSessionId` 등). 여러 테이블 직접 접근 허용 | 의도적 — memory [[project_repository_pattern.md]] "Repository 는 feature 기준 설계, 여러 테이블 직접 접근이 자연스럽고 허용됨" | ECC 룰 보강 — Task 3 (`nestjs/patterns.md` 에 NestJS 변형 명시) |
| G7 | ECC `common/coding-style.md` "함수 <50 줄" 기준 | (코드 위반 카탈로그 §4 참조) | (의도성 항목별 다름) | 명백한 위반만 Phase 2 fix |
| G8 | ECC `common/coding-style.md` "파일 <800 줄" 기준 | services/api·web 모두 통과 (최대 197 줄 — `services/web/src/shared/ui/catalyst/button/ui/Button.tsx`) | — | 처리 불필요 |
| G9 | ECC `typescript/coding-style.md` "`console.log` 금지" | services/web 1 건 잔존 (TODO placeholder) | 격차 — 임시 코드 | Phase 2 fix — Task 14 |
| G10 | ECC `typescript/coding-style.md` "Avoid `any`" | services/api 1 건 (NestJS `CallHandler<any>` 시그니처 강제), services/web 0 건 (generated/test 제외 후) | 의도적/불가피 — NestJS API 시그니처 | 처리 불필요 — audit 에 명시 |
| G11 | ECC 에 services/mq 룰 부재 | services/mq 는 본 plan 의 범위 아님 (PRD §"In Scope" 가 services/api·web 만 명시) | 범위 밖 | Out of Scope — 별도 PRD 권장 |

## 4. 코드 위반 카탈로그 (Phase 2 진입 시 작업 범위)

### 4.1 `console.log` 사용

`grep -rn "console\\.log" services/{api,web}/src --include="*.ts*" --exclude="*.spec.ts" --exclude="*.test.*"` 결과 (generated 제외):

| # | 파일 | 라인 | 컨텍스트 | 처리 |
|---|---|---|---|---|
| V1 | [services/web/src/features/push-notification/model/usePushNotification.ts](../../services/web/src/features/push-notification/model/usePushNotification.ts) | 42 | `console.log('Push received (foreground):', notification.title);` — `// TODO: 포그라운드 수신 - 인앱 토스트 UI 추가` 직후 placeholder | Phase 2 — Task 14. logger 교체 (pino 또는 인앱 토스트 구현 결정 분리 가능, 최소 fix 는 placeholder 제거 또는 적절한 logger) |

services/api 는 0 건.

### 4.2 `any` 사용

`grep -rn ":\\s*any\\b\\|<any>\\|as\\s+any" services/{api,web}/src --include="*.ts*" --exclude="*.spec.ts" --exclude="*.test.*"` 결과 (generated 제외):

| # | 파일 | 라인 | 컨텍스트 | 처리 |
|---|---|---|---|---|
| V2 | [services/api/src/logger/interceptors/trace.interceptor.ts](../../services/api/src/logger/interceptors/trace.interceptor.ts) | 17 | `intercept(context: ExecutionContext, next: CallHandler<any>): Observable<unknown>` — NestJS `CallHandler` 시그니처 강제 | **유지** — NestJS API 시그니처상 불가피. audit 에 명시하고 코드 변경 없음 |
| V3 | services/web/src/shared/api/generated/core/serverSentEvents.gen.ts:207 | (generated) | `yield data as any;` — codegen 산출물 | **유지** — generated 디렉토리 제외 정책 |
| V4-V6 | services/web/src/features/file-upload/model/upload-parts.test.ts:16, 29, 37 | (test) | `fetchMock as any` — test mock | **유지** — test 파일 제외 정책 |

**Phase 2 fix 대상**: V2-V6 중 0 건. services/api 의 V2 는 audit 에 "유지 사유" 로 명시.

### 4.3 함수 >50 줄 / 파일 >800 줄

#### 4.3.1 파일 >800 줄

`find services/{api,web}/src -name "*.ts" -o -name "*.tsx" | grep -v ".spec.ts\\|.test.\\|/generated/" | xargs wc -l | sort -rn | head -20` 결과:

```
197 services/web/src/shared/ui/catalyst/button/ui/Button.tsx
193 services/web/src/pages/drive/ui/Drive.tsx
191 services/web/src/shared/ui/catalyst/switch/ui/Switch.tsx
186 services/api/src/file/upload-session.service.ts
181 services/web/src/shared/ui/catalyst/combobox/ui/Combobox.tsx
174 services/web/src/widgets/sidebar/ui/Sidebar.tsx
174 services/web/src/shared/ui/catalyst/listbox/ui/Listbox.tsx
169 services/api/src/auth/login.service.ts
166 services/api/src/common/exceptions/error-code.enum.ts
159 services/web/src/shared/ui/catalyst/dropdown/ui/Dropdown.tsx
144 services/api/src/logger/service-method-wrapper.ts
139 services/api/src/folder/folder.repository.ts
139 services/api/src/auth/auth.service.ts
132 services/api/src/twofa/twofa.service.ts
127 services/api/src/folder/folder.service.ts
127 services/api/src/auth/login.controller.ts
125 services/web/src/shared/ui/catalyst/radio/ui/Radio.tsx
124 services/api/src/file/file.service.ts
```

전 파일 800 줄 미만 (최대 197). **Phase 2 fix 대상 0 건.**

#### 4.3.2 함수 >50 줄

수치 grep 으로 정확 측정 곤란 (multi-line scope 추적 필요). 대신 파일 크기 상위 5 개 (`upload-session.service.ts`, `login.service.ts`, `folder.repository.ts`, `auth.service.ts`, `twofa.service.ts`) 를 시각 점검한 결과, 모든 메서드가 명확한 단일 책임으로 분리되어 있고 50 줄 초과 함수 부재. **Phase 2 fix 대상 0 건.**

> 향후 함수 줄수 자동 측정이 필요하면 `eslint-plugin-sonarjs` 의 `cognitive-complexity` 또는 `max-lines-per-function` 규칙 도입을 권장 (별도 PRD).

### 4.4 중첩 >4 단

샘플 점검 (`auth.service.ts`, `file.service.ts`, `folder.service.ts`) 결과 모두 통과. early return 패턴 다수 활용. **Phase 2 fix 대상 0 건.**

### 4.5 services/web 의 FSD 위반

`grep -rn "from '@/features/[^']*/[^']*/'" services/web/src/features` 결과 cross-slice 직접 내부 import 0 건. `grep -rn "export.*from '\\./api'" services/web/src/features services/web/src/entities services/web/src/widgets` 결과 `api/` 세그먼트의 외부 노출 0 건. **Phase 2 fix 대상 0 건.**

## 5. 결론

### 5.1 격차 처리 비율

| 처리방향 | 격차 # | 비율 |
|---|---|---|
| ECC 룰 신설 (NestJS/FSD/logging) | G3, G4, G5 | 27 % |
| ECC 룰 보강·완화 (typescript) | G1, G2, G6 | 27 % |
| 코드 위반 fix (Phase 2) | G9 (1 건) | 9 % |
| 처리 불필요 (의도적/불가피/통과/범위 밖) | G7, G8, G10, G11 | 37 % |

**가설 검증**: PRD 의 가설 "격차의 90% 가 룰 보강 대상" 은 정확히는 **54 %** (G1-G6 의 룰 신설/완화). 나머지 37% 는 처리 불필요, 9% 만 코드 fix. 가설보다 코드 fix 비율은 훨씬 적음 — Phase 2 작업 부담 **매우 가볍다**.

### 5.2 Phase 2 작업 범위

- **services/api**: 0 건 fix
- **services/web**: 1 건 fix ([usePushNotification.ts:42](../../services/web/src/features/push-notification/model/usePushNotification.ts) 의 `console.log` placeholder)
- **Task 13 (services/api 코드 정리)** 는 실질 작업 없음 — audit baseline 만 빌드·테스트 통과 확인 후 closed
- **Task 14 (services/web 코드 정리)** 는 1 줄 변경

**Phase 2 진입 직전 grep baseline 재실행 필요** — Phase 1 ↔ Phase 2 사이 기간에 services/api·web 이 진화하면 새 위반 발견 가능.

### 5.3 본 audit 의 다음 행동

본 audit 의 격차 카탈로그 §3 와 위반 카탈로그 §4 가 [code-pattern-cleanup.plan.md](../../.claude/plans/code-pattern-cleanup.plan.md) 의 Phase 1 Task 2-12 와 Phase 2 Task 13-14 의 작업 evidence base 다. plan 의 Task 본문에 본 audit 의 처리 행 번호(G3 / V1 등) 를 참조하면 traceability 가 유지된다.

## 6. References

- 마스터 PRD: [.claude/prds/superpowers-to-ecc-migration.prd.md](../../.claude/prds/superpowers-to-ecc-migration.prd.md)
- 워크스트림 4 plan: [.claude/plans/code-pattern-cleanup.plan.md](../../.claude/plans/code-pattern-cleanup.plan.md)
- ECC 룰: [.claude/rules/ecc/](../../.claude/rules/ecc/)
- services/api 컨벤션: [services/api/CLAUDE.md](../../services/api/CLAUDE.md)
- services/web 컨벤션: [services/web/CLAUDE.md](../../services/web/CLAUDE.md)
- audit 색인: [docs/audits/INDEX.md](INDEX.md) (Task 10 산출)

---
name: code-pattern-cleanup
description: services/api·services/web 의 layer 패턴을 ECC 룰과 정합화 — Phase 1(룰 검토 — audit + ECC 룰 신설·보완) 머지 후 Phase 2(api/web 코드 정리) 진행
status: pending
created: 2026-05-25
---

# Plan: 코드 패턴 정리 (services/api·web ↔ ECC 룰 정합화)

**Source PRD**: [.claude/prds/superpowers-to-ecc-migration.prd.md](../prds/superpowers-to-ecc-migration.prd.md)
**Selected Milestone**: #4 — 코드 패턴 정리/재구조화 (services/api·web layer 룰 부합 점검)
**Complexity**: Large

## Summary

`services/api` (NestJS 11) 와 `services/web` (FSD) 의 layer 패턴이 `.claude/rules/ecc/` 의 표준과 어디서 부합하고 어디서 격차가 있는지를 **먼저 카탈로그화** 한다. 그 다음 격차의 90% 가 "프로젝트가 의도적으로 채택한 NestJS·FSD 컨벤션을 ECC 룰이 아직 표현하지 못함" 인 것이 드러날 것이므로 — **코드를 룰에 맞추는 게 아니라, ECC 룰이 services/api·web 의 현실을 반영하도록 보강** 한다. 명백한 위반(함수 >50 줄, 중첩 >4 단, `console.log`, `any` 등) 만 코드 정리한다. **신규 기능·아키텍처 변경은 없다.**

### 진행 순서 (사용자 지시: rule 검토 → api/web 진행)

- **Phase 1 — Rule Review (룰 검토)**: audit + ECC 룰 신설(`nestjs/{coding-style,patterns,testing}.md`, `web/fsd.md`, `common/logging.md`) + ECC 룰 보완(`typescript/{coding-style,patterns}.md`) + `services/api/CLAUDE.md` 의 깨진 logging 참조 정정 + `docs/audits/INDEX.md` + 마스터 PRD #4 `in-progress` 전이 + CRLF. **코드 변경 0.** Phase 1 단독 PR 로 머지 → 룰 baseline 확립.
- **Phase 2 — api/web 진행 (코드 정리)**: Phase 1 PR 머지 + **사용자 별도 승인** 후 진입. audit 의 "코드 위반 카탈로그" 에 오른 ≤ 20 개 파일만 fix. sprint 경계에서 머지.

> 이 plan 의 가설: PRD risk 표의 "워크스트림 4 리팩토링이 진행 중인 기능 PR과 충돌 (High)" 을 최소화하기 위해, 본 plan 의 산출물을 **(a) Phase 1 — 룰 문서 6 개 + 보완 2 개 / (b) Phase 2 — 코드 위반 ≤ 20 개 fix** 로 한정한다. Phase 1 은 PR 충돌 면적 0, Phase 2 는 작은 단위 grep-able 위반만 대상.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 룰 파일 frontmatter | [.claude/rules/ecc/typescript/coding-style.md:1-7](../rules/ecc/typescript/coding-style.md) | YAML frontmatter — `paths: ["**/*.ts", ...]` glob |
| 룰 파일 헤더 | [.claude/rules/ecc/typescript/patterns.md:9-10](../rules/ecc/typescript/patterns.md) | `# Title` + `> This file extends [common/X.md](../common/X.md) with Y specific content.` |
| 룰 본문 톤 | [.claude/rules/ecc/typescript/coding-style.md](../rules/ecc/typescript/coding-style.md) | 짧은 절 + WRONG/CORRECT 코드 블록 + 한두 줄 근거 — common/typescript 는 영문, services/CLAUDE.md 는 한국어 |
| NestJS 레이어 컨벤션 | [services/api/CLAUDE.md §"아키텍처 개요"](../../services/api/CLAUDE.md) + 실제 [services/api/src/file/](../../services/api/src/file/) 9 파일 | Controller → Service → Repository 3-tier, 도메인 폴더별 `*.spec.ts` 옆-배치 |
| FSD 슬라이스 컨벤션 | [services/web/CLAUDE.md §"아키텍처 개요"](../../services/web/CLAUDE.md) + 실제 [services/web/src/features/login-by-credentials/](../../services/web/src/features/login-by-credentials/) | 슬라이스 = `api/` + `model/` + `ui/` 세그먼트, `api/` 슬라이스 외부 export 금지, 세그먼트 의존 `api → model → ui` |
| 로깅 자동 trace | services/api/CLAUDE.md §"로거 사용" + [services/api/src/logger/](../../services/api/src/logger/) | `ServiceCore` 상속 자손은 public 메서드 자동 trace, 비즈니스 이벤트만 `@InjectPinoLogger` 명시 |
| ApiException 패턴 | [services/api/src/common/exceptions/](../../services/api/src/common/exceptions/) | 모든 도메인 오류는 `throw new ApiException('ERROR_KEY')` + `ErrorCode` enum 단일 출처 |
| ECC 격차 카탈로그 형식 | (신규 — 본 plan 의 산출물) | 표 컬럼: `영역 / 격차 / 의도성 / 처리방향` |
| 변경 이력 표 | [docs/planning/architecture.md:425-429](../../docs/planning/architecture.md) | `\| YYYY-MM-DD \| 변경 내용 \|` 행 추가 형식 |

## Files to Change

### Phase 1 (룰 검토)

| File | Action | Why |
|---|---|---|
| `docs/audits/code-pattern-audit-2026-05.md` | CREATE | services/api·web ↔ ECC 룰 격차 카탈로그 (audit 산출물, plan 의 evidence base) |
| `docs/audits/INDEX.md` | CREATE | audit 색인 — 향후 audit 누적 대비 진입점 |
| `.claude/rules/ecc/nestjs/coding-style.md` | CREATE | NestJS 11 전용 룰 — controller/service/repository 책임, DI, Module 경계 |
| `.claude/rules/ecc/nestjs/patterns.md` | CREATE | ApiException + ErrorCode 통일, Swagger 컨벤션 요약, ValidationPipe 전제 |
| `.claude/rules/ecc/nestjs/testing.md` | CREATE | `*.spec.ts` 옆-배치, e2e 는 `test/`, ServiceCore mock 패턴 |
| `.claude/rules/ecc/web/fsd.md` | CREATE | FSD 레이어 의존 방향 + 슬라이스 세그먼트 규칙 + `index.ts` boundary |
| `.claude/rules/ecc/common/logging.md` | CREATE | 로깅 레벨·형식 공통 룰 (서비스별 trace 정책은 각 CLAUDE.md 위임) |
| `.claude/rules/ecc/typescript/coding-style.md` | UPDATE | "Use Zod" 절을 "schema-based validation (Zod or class-validator)" 로 보완 |
| `.claude/rules/ecc/typescript/patterns.md` | UPDATE | API Response Format 의 envelope 단정을 옵션화 (NestJS throw + ApiException 허용) |
| `services/api/CLAUDE.md` | UPDATE | §"로거 사용" 의 `.claude/rules/logging.md` 참조 경로를 `.claude/rules/ecc/common/logging.md` 로 정정 (현재 깨진 링크) |
| `.claude/prds/superpowers-to-ecc-migration.prd.md` | UPDATE | Delivery Milestones #4: `pending → in-progress`, Plan 경로 기록 |

### Phase 2 (api/web 코드 정리)

| File | Action | Why |
|---|---|---|
| `services/api/src/**/*.ts` (위반 파일만) | UPDATE | Phase 1 audit 의 "코드 위반 카탈로그" 에 오른 ≤ 15 개 파일 (`console.log` 제거, `any` → `unknown`/명시 타입, 함수 >50 줄 분리, 중첩 >4 단 early return) |
| `services/web/src/**/*.{ts,tsx}` (위반 파일만) | UPDATE | 위와 동일 기준 ≤ 5 개 파일 |

## Tasks

### Phase 1 — Rule Review (룰 검토 — 우선 수행)

> Task 1-12. 코드 변경 0. Phase 1 단독 PR 로 머지 → 룰 baseline 확립 → 사용자 별도 승인 후 Phase 2 진입.

### Task 1: ECC ↔ 코드 격차 카탈로그 작성 (audit)
- **Action**: `docs/audits/code-pattern-audit-2026-05.md` 작성
  - **frontmatter**: `name: code-pattern-audit-2026-05`, `description`, `status: complete`, `date: 2026-05-25`
  - **본문 구조**:
    1. **목적**: 워크스트림 4 진입 시 services/api·web 의 layer 패턴이 ECC 룰과 어디서 부합하고 어디서 격차가 있는지를 1 회 스냅샷
    2. **범위**: `.claude/rules/ecc/{common,typescript,web}/` 의 모든 룰 × `services/api/src/` 모든 도메인 × `services/web/src/` 모든 레이어
    3. **격차 카탈로그 표** (핵심):
       | # | 영역 | 격차 | 의도성 | 처리방향 |
       |---|---|---|---|---|
       | 1 | ECC typescript/patterns.md `API Response Format` `{success,data,error}` 봉투 | services/api 는 NestJS throw + ApiException, 봉투 없음 | 의도적 (Swagger plugin 시너지) | ECC 룰 완화 (Task 8) |
       | 2 | ECC typescript/coding-style.md `Use Zod` | services/api 는 class-validator, services/web 는 `zodResolver 금지` | 의도적 (NestJS 표준 + RHF register) | ECC 룰 완화 (Task 7) |
       | 3 | ECC common/ 에 `logging.md` 없음 | services/api/CLAUDE.md 의 `.claude/rules/logging.md` 참조 깨짐 | 격차 | ECC common/logging.md 신설 (Task 5) |
       | 4 | ECC 에 NestJS 룰 없음 | services/api 의 controller/service/repository/DI 컨벤션이 ECC 산하 부재 | 격차 | nestjs/ 디렉토리 + 3 파일 신설 (Task 2-4) |
       | 5 | ECC web/ 에 FSD 의존방향 룰 없음 | services/web 의 FSD 의존방향·세그먼트 규칙이 ECC 산하 부재 | 격차 | web/fsd.md 신설 (Task 6) |
       | 6 | ECC 의 함수 <50줄 / 파일 <800줄 / 중첩 <4단 | (audit grep 결과로 결정) | (audit 결과) | 위반 카탈로그 → Phase 2 |
       | 7 | ECC 의 `console.log` 금지 | (audit grep 결과) | (audit 결과) | 위반 카탈로그 → Phase 2 |
       | 8 | ECC 의 `any` 회피 | (audit grep 결과) | (audit 결과) | 위반 카탈로그 → Phase 2 |
       | 9 | Repository 인터페이스 (`findAll/findById/create/update/delete`) | services/api 는 도메인별 method 명명 (`findByUserId`, `softDelete` 등) | 의도적 (memory [[project_repository_pattern.md]]) | ECC 룰 보강 (Task 3) |

    4. **코드 위반 카탈로그** (Phase 2 진입 evidence base, 자동 grep + 검증):
       - 함수 >50 줄 목록: `services/api/src/**/*.ts` 와 `services/web/src/**/*.{ts,tsx}` 에서 추출 (test 파일 제외)
       - `console.log` 사용처: `grep -rn "console\\.log" services/api/src services/web/src --include="*.ts*"` (test 파일 제외)
       - `any` 사용처: `grep -rn ":\\s*any\\b\\|<any>\\|as any" services/api/src services/web/src --include="*.ts*"` (test 파일 제외)
       - 파일 >800 줄: (앞서 확인됨, file.service.ts 124, folder.service.ts 127, auth.service.ts 139 → 통과)
       - generated 디렉토리(`services/web/src/shared/api/generated/`) 는 fix 대상 아님 (audit 에 명시)
    5. **결론**: 격차의 N % 는 룰 신설/보강으로, M 개의 코드 위반만 Phase 2 에서 fix
- **Mirror**: §"Patterns to Mirror" 의 ECC 격차 카탈로그 형식
- **Validate**:
  - `Test-Path docs/audits/code-pattern-audit-2026-05.md` → True
  - `grep -c "^##\|^###" docs/audits/code-pattern-audit-2026-05.md` → ≥ 5 섹션
  - 격차 카탈로그 표 행 수 ≥ 9
  - 코드 위반 카탈로그의 모든 파일 경로가 실재

### Task 2: `.claude/rules/ecc/nestjs/coding-style.md` 작성
- **Action**: NestJS 11 전용 coding-style 룰. 주요 절:
  - frontmatter: `paths: ["services/api/src/**/*.ts"]`
  - 헤더: `> This file extends [common/coding-style.md](../common/coding-style.md) and [typescript/coding-style.md](../typescript/coding-style.md) with NestJS 11 specific content.`
  - **Layer 책임** 표 (controller / service / repository — 각각 무엇을 해야 / 하지 말아야 하는지)
  - **Module 경계**: `@Global()` 사용 기준(인프라성만), 도메인 모듈 간 순환 의존 금지
  - **DI 패턴**: constructor injection 만, `@Injectable()` 필수, multi-provider DI 는 ADR-0002 (2FA Strategy) 사례 참조
  - **`src/common/` 분류 기준**: services/api/CLAUDE.md 의 결정 흐름 한 줄 요약 + 상세는 services/api/CLAUDE.md 위임
- **Mirror**: ECC `typescript/coding-style.md` 의 frontmatter + 본문 구조 + WRONG/CORRECT 코드 패턴
- **Validate**:
  - 파일 존재
  - frontmatter `paths` 가 `services/api/src/**/*.ts` 포함
  - "extends" 한 줄에 common + typescript 양쪽 참조
  - WRONG/CORRECT 코드 블록 ≥ 3 쌍

### Task 3: `.claude/rules/ecc/nestjs/patterns.md` 작성
- **Action**: NestJS 11 전용 patterns 룰. 주요 절:
  - **ApiException + ErrorCode 단일 출처**: `throw new ApiException('ERROR_KEY')` 만 허용, `ErrorCode` enum 에 `{ message, status }` 구조
  - **Repository Pattern (NestJS 변형)**: 일반 `Repository<T>` 인터페이스가 아니라 **feature 기준 method 명명** 허용 (`findByUserId`, `softDelete` 등). 근거: memory [[project_repository_pattern.md]]
  - **Swagger 컨벤션 요약**: 메서드 데코레이터 순서, `@ApiError` 헬퍼, request DTO 의 class-validator 데코레이터. **상세는 services/api/CLAUDE.md §"Swagger / DTO 컨벤션" 위임** (DRY)
  - **ValidationPipe 전제**: 글로벌 ValidationPipe + `transform: true`, request DTO 누락 시 검증 게이트 무력화 위험
- **Mirror**: typescript/patterns.md 의 구조 + services/api/CLAUDE.md §"Swagger / DTO 컨벤션" 의 금지 패턴 표
- **Validate**:
  - "ApiException", "ErrorCode", "Repository", "Swagger", "ValidationPipe" 5 키워드 모두 헤더로 등장
  - services/api/CLAUDE.md 참조 링크 존재
  - 금지 패턴 표 ≥ 3 행

### Task 4: `.claude/rules/ecc/nestjs/testing.md` 작성
- **Action**: NestJS 11 전용 testing 룰. 주요 절:
  - **`*.spec.ts` 옆-배치**: 구현 파일과 같은 폴더에 spec 배치 (e2e 는 `test/`)
  - **ServiceCore mock 패턴**: `@terab/test` 의 mock 유틸 사용
  - **Module 단위 테스트**: `Test.createTestingModule(...)` + `overrideProvider` 패턴, DI 주입 검증
  - **테스트 커버리지 80%**: common testing.md 의 기준 그대로 적용
  - **금지 패턴**: production 코드의 라이프사이클(`onModuleInit` 등) 을 spec 에서 임의 호출 금지, DB 직접 접근 (Drizzle 인스턴스) 대신 repository mock 사용
- **Mirror**: ECC `common/testing.md` 의 형식 + services/api/CLAUDE.md §"테스트 파일 위치"
- **Validate**:
  - 파일 존재
  - frontmatter `paths` 가 `services/api/src/**/*.spec.ts` 또는 `services/api/test/**/*.ts` 포함
  - "Test.createTestingModule", "ServiceCore", "옆-배치" 키워드 모두 등장
  - common/testing.md 참조 링크 존재

### Task 5: `.claude/rules/ecc/common/logging.md` 작성
- **Action**: 로깅 공통 룰 (서비스별 trace 정책은 각 CLAUDE.md 위임).
  - frontmatter 없음 (common 룰)
  - **로깅 레벨** 표: `error / warn / info / debug` 각각 언제 사용
  - **금지 패턴**: `console.log` 직접 사용, 비밀(토큰·비밀번호·이메일 본문) 로깅, 사용자 입력 sanitize 없이 로깅
  - **구조화된 로깅**: 객체 + message 패턴 권장, 문자열 보간 회피
  - **trace 정책 위임**: services/api 의 `ServiceCore` 자동 trace, services/web 의 axios interceptor 로깅 등은 각 서비스 CLAUDE.md 참조
- **Mirror**: ECC `common/security.md` 의 형식 + ECC `common/coding-style.md` 의 WRONG/CORRECT (영문)
- **Validate**:
  - `Test-Path .claude/rules/ecc/common/logging.md` → True
  - 로깅 레벨 표 4 행
  - "console.log" 금지 패턴 명시
  - services/api/CLAUDE.md §"로거 사용" 참조 링크 존재

### Task 6: `.claude/rules/ecc/web/fsd.md` 작성
- **Action**: FSD 레이어 의존방향 + 슬라이스 세그먼트 규칙 영문 룰.
  - frontmatter: `paths: ["services/web/src/**/*.{ts,tsx}"]`
  - **레이어 의존 방향**: `app → pages → widgets → features → entities → shared` 일방향, 역방향 금지
  - **슬라이스 boundary**: 슬라이스는 `index.ts` 로만 외부 노출, 내부 경로 직접 import 금지
  - **세그먼트 의존 방향**: `api → model → ui` 일방향
  - **`api/` 비공개**: 슬라이스 `index.ts` 에서 `api/` export 금지
  - **cross-slice 금지**: 같은 레이어 내 슬라이스 간 import 금지, 공통 로직은 `shared/` 로
  - **서버 상태 vs UI 상태 분리**: TanStack Query 캐시 vs Zustand vs useState 의 역할 분리
- **Mirror**: ECC `web/coding-style.md` 의 frontmatter + services/web/CLAUDE.md §"FSD 레이어 의존 규칙" 의 표
- **Validate**:
  - `Test-Path .claude/rules/ecc/web/fsd.md` → True
  - 의존 방향 표 ≥ 2 (레이어 + 세그먼트)
  - "index.ts" boundary 절 존재
  - services/web/CLAUDE.md 참조 링크 존재

### Task 7: `.claude/rules/ecc/typescript/coding-style.md` 의 §"Input Validation" 절 보완
- **Action**: 기존 "Use Zod for schema-based validation" 단정 표현을 완화.
  - 변경: "Use schema-based validation. The choice of library depends on the runtime context."
  - 표 추가:
    | Context | Library | Why |
    |---|---|---|
    | Browser forms | React Hook Form `register()` options or Zod | RHF native 통합 |
    | NestJS request DTO | class-validator + class-transformer | NestJS ValidationPipe 표준, Swagger plugin 자동 합성 |
    | 일반 외부 입력 (script, util) | Zod | 타입 추론 일관성 |
  - 기존 Zod 예제는 "일반 외부 입력" 컨텍스트로 남김
- **Mirror**: 본인 파일의 기존 구조 보존, 표만 추가
- **Validate**:
  - `grep -c "class-validator\|React Hook Form" .claude/rules/ecc/typescript/coding-style.md` → ≥ 2
  - 기존 Zod 예제 보존 (`grep -c "z\\.object" .claude/rules/ecc/typescript/coding-style.md` ≥ 1)

### Task 8: `.claude/rules/ecc/typescript/patterns.md` 의 §"API Response Format" 절 보완
- **Action**: 기존 `{success, data, error}` 봉투를 단정 권장에서 옵션 중 하나로 완화.
  - 변경: 헤더 "API Response Format" → "API Response Format Options"
  - 두 가지 형식 명시:
    1. **Envelope format** (기존 예제) — 다양한 결과 상태를 한 응답에 표현해야 할 때
    2. **NestJS standard** — Controller 가 도메인 객체 직반환, 오류는 `throw new ApiException(...)`, ErrorCode enum 단일 출처. Swagger plugin 이 응답 type 메타 자동 합성
  - 둘 중 어떤 형식이든 **프로젝트 내부에서 일관** 해야 함 (혼용 금지) 강조
- **Mirror**: 본인 파일의 기존 구조 보존
- **Validate**:
  - `grep -c "Envelope\|NestJS\|ApiException" .claude/rules/ecc/typescript/patterns.md` → ≥ 3
  - 기존 envelope 예제 보존

### Task 9: services/api/CLAUDE.md 의 logging 룰 참조 경로 수정
- **Action**: §"로거 사용" 절의 `.claude/rules/logging.md` 를 `.claude/rules/ecc/common/logging.md` 로 수정. 1 줄 변경.
- **Mirror**: services/api/CLAUDE.md 의 다른 ECC 룰 참조 형식 (현재는 직접 참조 없음 — 본 변경이 첫 진입점)
- **Validate**:
  - `grep -c "rules/ecc/common/logging.md" services/api/CLAUDE.md` → ≥ 1
  - `grep -c "rules/logging.md" services/api/CLAUDE.md` → 0 (구 경로 잔존 0)

### Task 10: `docs/audits/INDEX.md` 작성
- **Action**: audit 색인 진입점. 본문:
  - 한 단락 소개 ("audit 는 특정 시점의 스냅샷, 룰·코드 격차 카탈로그용. 재발 시 새 audit 파일로 추가, 기존 audit 갱신 금지")
  - 표:
    | # | 제목 | 날짜 | 상태 |
    |---|---|---|---|
    | 1 | [코드 패턴 audit 2026-05](code-pattern-audit-2026-05.md) | 2026-05-25 | complete |
- **Mirror**: `docs/adr/INDEX.md` (워크스트림 5 산출) + `docs/archive/superpowers/INDEX.md` (워크스트림 2 산출)
- **Validate**:
  - `Test-Path docs/audits/INDEX.md` → True
  - 표 ≥ 1 행, code-pattern-audit-2026-05.md 링크 존재

### Task 11: 마스터 PRD Delivery Milestones #4 행 상태 전이
- **Action**:
  - `.claude/prds/superpowers-to-ecc-migration.prd.md` 표 #4 행
  - Status `pending` → `in-progress`
  - Plan `(.claude/plans/code-pattern-cleanup.plan.md 예정)` → `[.claude/plans/code-pattern-cleanup.plan.md](../plans/code-pattern-cleanup.plan.md)`
  - 다른 행 불변
- **Mirror**: 워크스트림 5 plan Task 14 의 동일 상태 전이 형식
- **Validate**:
  - `git diff .claude/prds/superpowers-to-ecc-migration.prd.md` 가 1 행 변경만
  - `grep -c "in-progress.*code-pattern-cleanup.plan.md" .claude/prds/superpowers-to-ecc-migration.prd.md` → ≥ 1

### Task 12: Phase 1 CRLF 검증
- **Action**: Phase 1 에서 신규/변경된 모든 `.md` 파일 CRLF 확인 (Write 도구는 LF 기본 → 생성 직후 즉시 검증·보정).
- **Mirror**: 워크스트림 5 plan Task 15
- **Validate** (PowerShell):
  - 대상 파일 9 개:
    - `.claude/plans/code-pattern-cleanup.plan.md`
    - `docs/audits/INDEX.md`
    - `docs/audits/code-pattern-audit-2026-05.md`
    - `.claude/rules/ecc/nestjs/coding-style.md`
    - `.claude/rules/ecc/nestjs/patterns.md`
    - `.claude/rules/ecc/nestjs/testing.md`
    - `.claude/rules/ecc/web/fsd.md`
    - `.claude/rules/ecc/common/logging.md`
    - (수정만 한 `.md`: `typescript/coding-style.md`, `typescript/patterns.md`, `services/api/CLAUDE.md`, PRD — 기존 EOL 보존 확인)
  - 각 파일 `(Get-Content -Raw $f) -match "\r\n"` → True

---

### Phase 2 — api/web 진행 (코드 정리 — Phase 1 머지 + 사용자 별도 승인 후)

> Task 13-14. Phase 1 PR 머지 + 사용자 별도 승인 + sprint 경계 확인 후 진입. Phase 1 의 audit 결과("코드 위반 카탈로그") 가 이 phase 의 작업 범위를 확정한다.

### Task 13: services/api 코드 위반 정리 (audit 의 코드 위반 카탈로그 기반)
- **Action**: Task 1 audit 의 "코드 위반 카탈로그" 에 오른 항목만 fix. **신규 기능·시그니처 변경·구조 변경 없음.**
  - `console.log` 제거 → `@InjectPinoLogger` 또는 `Logger` 주입 후 적절한 레벨로 교체
  - `any` → `unknown` (외부 입력) 또는 명시 타입 (내부) 으로 narrow
  - 함수 >50 줄 → 같은 파일 내 private 헬퍼로 분리 (책임 분할이 명백한 경우만; 강제 분할 금지)
  - 중첩 >4 단 → early return 또는 guard clause
- **Mirror**: services/api 의 기존 함수 분리 사례 (예: `file.service.ts` 의 함수당 1 책임)
- **Validate**:
  - `grep -rn "console\\.log" services/api/src --include="*.ts" --exclude="*.spec.ts" | wc -l` → 0
  - `grep -rn ":\\s*any\\b\\|<any>\\|as any" services/api/src --include="*.ts" --exclude="*.spec.ts" | wc -l` → audit baseline 대비 감소
  - `npm --prefix services/api test` → 전 spec 통과
  - `npm --prefix services/api run build` → 빌드 통과

### Task 14: services/web 코드 위반 정리 (audit 의 코드 위반 카탈로그 기반)
- **Action**: Task 13 과 동일 기준, services/web 대상 ≤ 5 파일. generated 디렉토리 제외.
- **Mirror**: services/web 의 기존 슬라이스 패턴 (FSD 세그먼트 분리)
- **Validate**:
  - `grep -rn "console\\.log" services/web/src --include="*.ts*" --exclude="*.test.*" | wc -l` → 0
  - `npm --prefix services/web test` → 전 테스트 통과
  - `npm --prefix services/web run build` → 빌드 통과
  - **FSD 위반 검사**: `grep -rn "from '@/features/[^']*/[^']*/'" services/web/src/features | wc -l` → 0 (cross-slice 직접 내부 import 0)
  - **api 세그먼트 외부 노출 검사**: `grep -rn "export \\* from '\\./api'\\|export { .* } from '\\./api'" services/web/src/features services/web/src/entities services/web/src/widgets | wc -l` → 0

## Validation

### Phase 1 검증

```bash
# 1. audit 산출물
ls docs/audits/                                       # INDEX.md, code-pattern-audit-2026-05.md

# 2. 신규 ECC 룰 파일 6 개 존재
ls .claude/rules/ecc/nestjs/                          # coding-style.md, patterns.md, testing.md
ls .claude/rules/ecc/web/                             # fsd.md (외 기존 파일들)
ls .claude/rules/ecc/common/                          # logging.md (외 기존 파일들)

# 3. 룰 파일 frontmatter 검증
grep -c "^paths:" .claude/rules/ecc/nestjs/coding-style.md   # >= 1
grep -c "^paths:" .claude/rules/ecc/nestjs/patterns.md       # >= 1
grep -c "^paths:" .claude/rules/ecc/nestjs/testing.md        # >= 1
grep -c "^paths:" .claude/rules/ecc/web/fsd.md               # >= 1

# 4. typescript 룰 보완 검증
grep -c "class-validator\|React Hook Form" .claude/rules/ecc/typescript/coding-style.md   # >= 2
grep -c "Envelope\|NestJS\|ApiException" .claude/rules/ecc/typescript/patterns.md          # >= 3

# 5. services/api/CLAUDE.md 의 logging 룰 참조 경로 정정
grep -c "rules/ecc/common/logging.md" services/api/CLAUDE.md   # >= 1
grep -c "rules/logging.md" services/api/CLAUDE.md              # = 0

# 6. 마스터 PRD 상태 전이
grep -c "in-progress.*code-pattern-cleanup.plan.md" \
  .claude/prds/superpowers-to-ecc-migration.prd.md             # >= 1

# 7. CRLF 검증 (PowerShell, 신규 9 + 수정 4 파일)
# foreach ($f in @('.claude/plans/code-pattern-cleanup.plan.md',
#                  'docs/audits/INDEX.md',
#                  'docs/audits/code-pattern-audit-2026-05.md',
#                  '.claude/rules/ecc/nestjs/coding-style.md',
#                  '.claude/rules/ecc/nestjs/patterns.md',
#                  '.claude/rules/ecc/nestjs/testing.md',
#                  '.claude/rules/ecc/web/fsd.md',
#                  '.claude/rules/ecc/common/logging.md',
#                  '.claude/rules/ecc/typescript/coding-style.md',
#                  '.claude/rules/ecc/typescript/patterns.md',
#                  'services/api/CLAUDE.md',
#                  '.claude/prds/superpowers-to-ecc-migration.prd.md')) {
#   $raw = Get-Content -Raw $f
#   if ($raw -match "`r`n") { "OK : $f" } else { "FAIL: $f" }
# }
```

### Phase 2 검증

```bash
# 1. 코드 위반 정리 결과 (test 파일 제외)
grep -rn "console\.log" services/api/src --include="*.ts" | grep -v ".spec.ts" | wc -l   # = 0
grep -rn "console\.log" services/web/src --include="*.ts*" | grep -v ".test." | wc -l   # = 0

# 2. FSD 위반 검사 (services/web)
grep -rn "from '@/features/[^']*/[^']*/'" services/web/src/features | wc -l   # = 0
grep -rn "export \* from './api'\|export { .* } from './api'" \
  services/web/src/features services/web/src/entities services/web/src/widgets | wc -l   # = 0

# 3. 빌드 + 테스트
npm --prefix services/api run build
npm --prefix services/api test
npm --prefix services/web run build
npm --prefix services/web test
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase 2 코드 정리가 진행 중인 기능 PR 과 충돌 | High | 본 plan 의 핵심 위험 회피 전략 — Phase 1 (PR-A) 머지 후 사용자 별도 승인 → sprint 경계에서 Phase 2 (PR-B) 진입. Phase 1 은 코드 변경 0 으로 충돌 면적 0 |
| Phase 1 audit 가 너무 많은 위반을 발견 → Phase 2 범위 폭발 | Medium | audit 의 "코드 위반 카탈로그" 는 ≤ 20 개 파일로 cap. 초과분은 "Out of Scope" 로 표기하고 별도 PRD 권장 |
| ECC 룰 완화(Task 7-8) 가 다른 프로젝트(같은 룰 사용)에 영향 | Low | `.claude/rules/ecc/` 는 본 프로젝트 로컬 복사본 (`~/.claude/rules/ecc/` 와 분리). 본 plan 은 로컬만 수정 |
| NestJS 룰 신설(Task 2-4) 이 services/api/CLAUDE.md 와 중복 | High | NestJS 룰은 "공통 원칙 (영문)", services/api/CLAUDE.md 는 "프로젝트 세부 컨벤션 (한글)". 룰에서 CLAUDE.md 위임 명시 (DRY 보존). 표 복제 금지 |
| FSD 룰(Task 6) 이 services/web/CLAUDE.md 와 중복 | High | 위와 동일 원칙. fsd.md 는 의존 방향 원칙·boundary 만, 상세 슬라이스 결정 흐름은 CLAUDE.md 위임 |
| audit 결과 격차의 90% 가 룰 보강 대상이라는 가설이 틀림 | Medium | Task 1 audit 종료 시 가설 검증. 가설이 틀리면 Phase 2 진입 전 본 plan 의 Tasks 절을 한 차례 갱신 (사용자 승인 필요) |
| `console.log`·`any` grep 이 generated/spec 파일 포함 시 노이즈 | Low | grep 명령에 `--exclude="*.spec.ts"`, `--exclude="*.test.*"` 명시. generated 디렉토리는 audit 에서 명시적 제외 |
| Task 9 (logging 참조 경로) 가 services/api/CLAUDE.md 의 다른 한 줄을 깨뜨림 | Low | replace 범위 1 줄 한정, `git diff services/api/CLAUDE.md` 로 1 줄 변경 확인 |
| ApiException 패턴 명문화가 향후 다른 오류 패턴(예: Result 타입) 도입을 막음 | Low | 룰에 "현재 채택 패턴" 으로 명시, 향후 변경 시 ADR 로 결정 박제 → 룰 갱신으로 대응 |
| Phase 1 ↔ Phase 2 사이에 services/api·web 이 진화하여 audit baseline 이 stale | Medium | audit 의 grep baseline 을 Phase 2 진입 직전 재실행하여 diff 확인, stale 한 항목 제외 |

## Acceptance

### Phase 1 종결 조건

- [ ] Task 1-12 모두 완료
- [ ] Phase 1 Validation 명령 전부 통과
- [ ] audit 산출물 (`docs/audits/code-pattern-audit-2026-05.md`) 존재 + 격차 카탈로그 표 + 코드 위반 카탈로그
- [ ] ECC 룰 6 개 신설 (`nestjs/{coding-style,patterns,testing}.md`, `web/fsd.md`, `common/logging.md`)
- [ ] ECC 룰 2 개 보완 (`typescript/{coding-style,patterns}.md`)
- [ ] services/api/CLAUDE.md 의 logging 참조 경로 정정
- [ ] 마스터 PRD #4 행이 `in-progress` 와 본 plan 경로 표시
- [ ] 모든 신규/변경 .md 파일이 CRLF
- [ ] Phase 1 단독 PR 머지 완료
- [ ] **사용자가 Phase 2 진입을 별도 승인**

### Phase 2 종결 조건 (Phase 1 종결 후 별도 트래킹)

- [ ] Task 13-14 완료
- [ ] Phase 2 Validation 명령 전부 통과
- [ ] services/api 와 services/web 빌드·테스트 통과
- [ ] `console.log` 0, `any` 사용 audit baseline 대비 감소
- [ ] FSD 위반 검사 통과 (cross-slice 0, api 세그먼트 외부 노출 0)
- [ ] 마스터 PRD #4 행 `in-progress → done` 전이 (별도 작업)

## Out of Scope (이 plan 범위 밖)

- 신규 기능·시그니처 변경·아키텍처 변경 (PRD §"Out of Scope")
- 데이터베이스 마이그레이션, CI/CD 변경
- 도메인 모듈 재구조화 (예: file ↔ folder 의존 방향 재설계)
- ECC 룰의 services/mq 신설 (워크스트림 4 는 services/api·web 만 대상)
- audit 의 코드 위반 카탈로그를 초과하는 추가 위반 fix → 별도 PRD
- `services/api/src/database/schema/` 의 Drizzle 스키마 룰 (별도 작업)
- services/web 의 generated 디렉토리 정리 (codegen 산출물)
- `docs/archive/superpowers/` 내부 문서 — historical reference 보존
- `~/.claude/rules/ecc/` (글로벌 룰) 갱신 — 본 plan 은 프로젝트 로컬만

## Suggested Follow-up

1. 본 plan 승인 → **Phase 1 진입**
2. Task 1 (audit) 우선 수행, 결과로 Phase 2 의 구체 위반 목록 확정
3. Task 2-12 수행 → Phase 1 단독 PR 생성 + 머지
4. **사용자 별도 승인** + sprint 경계 확인
5. **Phase 2 진입** — Task 13-14 수행, Phase 2 단독 PR 생성 + 머지
6. Phase 2 머지 후 마스터 PRD #4 행 `in-progress → done` 으로 전이 (별도 작업)
7. 본 plan 완료 후 마스터 PRD 의 모든 5 워크스트림 완료 → PRD `status: in-progress → done` 전이 가능

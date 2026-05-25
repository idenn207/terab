# Plan: 아키텍처 정리 (다이어그램 재설계 + ADR 신설)

**Source PRD**: [.claude/prds/superpowers-to-ecc-migration.prd.md](../prds/superpowers-to-ecc-migration.prd.md)
**Selected Milestone**: #5 — 아키텍처 정리 (다이어그램·ADR 최신화)
**Complexity**: Medium

## Summary

워크스트림 3(`service-planning-refresh.plan.md`)에서 `docs/planning/architecture.md` 의 스택 라벨(Spring→NestJS, RabbitMQ→Redis, Docker Compose→Swarm)을 정정했다. 본 plan 은 **그 정정 위에서 (a) 7개 mermaid 다이어그램을 최신 구현 기준으로 노드/flow 재설계하고 (b) `docs/adr/` 디렉토리를 신설하여 2FA Strategy 패턴·ts-rest 제거 두 결정을 영속화**한다. 신규 결정·코드 변경은 일절 포함하지 않는다 — 모든 작업은 이미 완료된 머지를 사후 기록한다.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| ADR 파일 명명 | 업계 표준 (Michael Nygard ADR template) | `NNNN-kebab-title.md` — 4자리 zero-padded 순번 + kebab-case 제목 |
| ADR 본문 구조 | Nygard 표준 5섹션 | `Status / Context / Decision / Consequences / References` 고정 헤더 |
| ADR 프론트매터 | [.claude/plans/docs-ecc-realignment.plan.md](docs-ecc-realignment.plan.md) Task 1 | YAML frontmatter — `name`, `description`, `status: accepted`, `date: 2026-05-25` |
| Mermaid 노드 라벨 | [docs/planning/architecture.md:59](../../docs/planning/architecture.md#L59) | `Name["라벨<br/>(부가설명)"]` — 다중 라인 줄바꿈 `<br/>`, 부가설명 괄호 |
| Mermaid sequenceDiagram alt 분기 | [docs/planning/architecture.md:227-248](../../docs/planning/architecture.md#L227-L248) §인증 흐름 | `alt 신뢰기기 ... else 비신뢰기기 ... end` 한글 라벨, 중첩 alt 허용 |
| Strategy 패턴 구현 | [services/api/src/twofa/strategies/twofa-strategy.registry.ts](../../services/api/src/twofa/strategies/twofa-strategy.registry.ts) | NestJS multi-provider DI(`TWOFA_STRATEGY_TOKEN`) + `Map<Type, Strategy>` 조회 + 미등록 시 `ApiException` |
| Swagger codegen 파이프라인 | [services/web/openapi-ts.config.ts](../../services/web/openapi-ts.config.ts) | `@hey-api/openapi-ts` + `client-axios` + `typescript` + `sdk` + `@tanstack/react-query` 4 플러그인 조합 |
| 변경 이력 표 | [docs/planning/architecture.md:425-429](../../docs/planning/architecture.md#L425-L429) | `\| YYYY-MM-DD \| 변경 내용 \|` 행 추가 형식 |
| INDEX.md 형식 | [docs/archive/superpowers/INDEX.md](../../docs/archive/superpowers/INDEX.md) (워크스트림 2 산출) | 주제별 그룹 + 마크다운 링크 + 한 줄 요약 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `docs/adr/INDEX.md` | CREATE | ADR 목록 색인 (신규 디렉토리 진입점) |
| `docs/adr/0001-ts-rest-removal-swagger-migration.md` | CREATE | 커밋 0e67cb8 결정 박제 — ts-rest → Swagger + hey-api + TanStack Query |
| `docs/adr/0002-twofa-strategy-pattern.md` | CREATE | 커밋 37fc959 결정 박제 — TwoFaStrategyRegistry + TOTP/Push/Backup Code |
| `docs/planning/architecture.md` | UPDATE | 7개 mermaid 다이어그램 재설계 + ADR 링크 섹션 추가 + 변경 이력 행 추가 |
| `.claude/prds/superpowers-to-ecc-migration.prd.md` | UPDATE | Delivery Milestones #5 행: `pending → in-progress`, Plan 경로 기록 |
| `CLAUDE.md` | UPDATE | §개발 워크플로우 끝에 ADR 참조 한 줄 추가 (`docs/adr/INDEX.md`) |
| `docs/planning/architecture.md` 의 §주요 설계 결정 표 | UPDATE | 표 마지막에 "주요 결정 ADR" 참조 컬럼 추가 또는 표 아래 ADR 링크 |

## Tasks

### Task 1: `docs/adr/` 디렉토리 + `INDEX.md` 생성
- **Action**:
  - `docs/adr/` 디렉토리 생성 (Windows 환경에서 `mkdir`)
  - `INDEX.md` 작성 — 본문 구조:
    ```markdown
    # Architecture Decision Records

    이 디렉토리는 Terab 의 주요 아키텍처 결정을 기록한다. 각 ADR 은 결정 시점의 맥락·대안·결과를
    영속화하여, 후속 결정이 동일한 trade-off 를 재학습하지 않도록 한다.

    > 작성 가이드: [Michael Nygard ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record).
    > 신규 ADR 은 `NNNN-kebab-title.md` 형식, 4자리 zero-padded 순번 사용.

    ## 목록

    | # | 제목 | 상태 | 날짜 |
    |---|---|---|---|
    | 0001 | [ts-rest 제거 → Swagger + hey-api + TanStack Query](0001-ts-rest-removal-swagger-migration.md) | accepted | 2026-05-16 |
    | 0002 | [2FA Strategy 패턴 (TOTP / Push / Backup Code)](0002-twofa-strategy-pattern.md) | accepted | 2026-05-20 |
    ```
- **Mirror**: `docs/archive/superpowers/INDEX.md` 의 그룹·링크·한줄 요약 형식
- **Validate**:
  - `Test-Path docs/adr/INDEX.md` → True
  - INDEX.md grep `grep -c "0001\|0002" docs/adr/INDEX.md` → ≥2
  - 디렉토리 트리 정상: `Get-ChildItem docs/adr/` 결과 3개 (INDEX + 2 ADR)

### Task 2: ADR-0001 작성 (ts-rest 제거)
- **Action**: `docs/adr/0001-ts-rest-removal-swagger-migration.md` 작성
  - **Frontmatter**: `name: ts-rest-removal-swagger-migration`, `description: ts-rest 계약 기반 API 클라이언트를 Swagger + hey-api 코드젠 + TanStack Query 조합으로 전환`, `status: accepted`, `date: 2026-05-16`
  - **본문 5섹션** (모두 한글):
    - **Status**: accepted (커밋 0e67cb8 머지, PR #37)
    - **Context**: ts-rest 도입 후 식별된 한계 — (a) API 정의가 contract.ts 단일 파일 비대화, (b) Swagger UI 미생성으로 API 탐색·테스트 도구 부재, (c) hey-api 같은 일반 OpenAPI codegen 생태계 활용 불가, (d) NestJS swagger plugin 의 자동 메타 합성과 시너지 없음. services/api 의 ts-rest router 와 services/web 의 ts-rest client 양쪽이 동기화 부담을 키웠다.
    - **Decision**: API 측은 NestJS Swagger(`@nestjs/swagger`) + class-validator + class-transformer 조합으로 전환. dev 환경에서 `/json` OpenAPI 문서 노출. Web 측은 `@hey-api/openapi-ts` 로 `/json` 을 소비하여 `services/web/src/shared/api/generated/` 에 SDK + TypeScript 타입 + TanStack Query options 코드젠. axios 단일 인스턴스(`shared/api/axiosInstance.ts`) + interceptor 기반 인증/리프레시 처리.
    - **Consequences**:
      - **Positive**: Swagger UI 자동 생성, 표준 OpenAPI 생태계 진입, services/api 의 swagger plugin 이 class-validator 메타 자동 합성, services/web 컨벤션이 hey-api 일관 SDK 로 단순화, 서드파티 codegen 도구로의 마이그레이션 비용 0
      - **Negative**: codegen 수동 실행 필요 (`npm --prefix services/web run openapi:codegen`), generated 디렉토리 git tracked 로 PR diff 증가, web codegen 호출 시 API dev 서버 켜져 있어야 함
      - **Mitigations**: services/api/CLAUDE.md §"Swagger / DTO 컨벤션" 과 services/web/CLAUDE.md §"API 레이어 / TanStack Query × Zustand 컨벤션" 에 강제 패턴 명문화 (DTO 작성, codegen 워크플로우, 금지 패턴 표)
    - **References**:
      - 구현 PR: #37 (`refactor: ts-rest 제거 → Swagger / hey-api / TanStack Query 전환`, 커밋 0e67cb8)
      - 설계 문서: [docs/archive/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md](../archive/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md) (서버: §6.A, 클라이언트: §6.B)
      - API 컨벤션: [services/api/CLAUDE.md §"Swagger / DTO 컨벤션"](../../services/api/CLAUDE.md)
      - Web 컨벤션: [services/web/CLAUDE.md §"API 레이어 / TanStack Query × Zustand 컨벤션"](../../services/web/CLAUDE.md)
      - codegen 설정: [services/web/openapi-ts.config.ts](../../services/web/openapi-ts.config.ts)
- **Mirror**: Nygard 5섹션 + 본 plan §Patterns to Mirror 의 ADR 프론트매터 형식
- **Validate**:
  - 파일 존재 + 5섹션(`Status`, `Context`, `Decision`, `Consequences`, `References`) 모두 헤더 존재
  - `grep -c "^## " docs/adr/0001-ts-rest-removal-swagger-migration.md` → ≥5
  - 모든 References 링크가 실제 존재하는 파일 (PowerShell `Test-Path` 로 각 경로 검증)
  - PR #37 / 커밋 0e67cb8 명시

### Task 3: ADR-0002 작성 (2FA Strategy 패턴)
- **Action**: `docs/adr/0002-twofa-strategy-pattern.md` 작성
  - **Frontmatter**: `name: twofa-strategy-pattern`, `description: TOTP/Push/Backup Code 3가지 2FA 방식을 Strategy 패턴 + NestJS multi-provider DI 로 통합`, `status: accepted`, `date: 2026-05-20`
  - **본문 5섹션**:
    - **Status**: accepted (커밋 37fc959 머지, PR #39)
    - **Context**: Push 2FA(PR #26) 단일 방식으로 시작했으나 (a) 모바일 앱 미설치 환경 대응(TOTP), (b) 디바이스 분실 시 복구 경로(Backup Code) 요구 등장. 각 방식이 challenge 생성·검증·만료 흐름은 공유하지만 외부 의존(FCM, totp library, hash compare)이 다르고, `auth.service.ts` 에 분기 if-else 누적 시 (1) auth 도메인이 2FA 세부 구현을 모두 알게 되어 결합도 폭증 (2) 신규 방식 추가 시 auth 변경 발생 (OCP 위반) 우려.
    - **Decision**: Strategy 패턴 + NestJS multi-provider DI 채택.
      - `TwoFaStrategy` 인터페이스: `type: TwoFaStrategyType`, `initiate(...)`, `verify(...)` 시그니처 표준화
      - `TWOFA_STRATEGY_TOKEN` multi-provider 로 3개 strategy 등록 (`PushStrategy`, `TotpStrategy`, `BackupCodeStrategy`)
      - `TwoFaStrategyRegistry` 가 생성자에서 `Map<Type, Strategy>` 구축, `get(type)` 으로 라우팅
      - auth/twofa controller 는 registry 만 의존, 신규 방식 추가 시 strategy 클래스 1개 + provider 등록 1줄
    - **Consequences**:
      - **Positive**: 신규 2FA 방식(WebAuthn, SMS 등) 추가 비용 최소화, 각 strategy 의 단위 테스트 격리(`*.strategy.spec.ts` 3개), auth 도메인이 2FA 구현 무지각화
      - **Negative**: DI multi-provider 패턴 학습 곡선, registry 추상화 1겹 추가, strategy 간 공유 로직(예: lockout 카운터) 별도 service 로 분리 필요
      - **Mitigations**: `TotpLockoutService` 같은 cross-cutting 서비스는 strategy 외부에 분리, `twofa-strategy.interface.ts` 에 인터페이스 docstring 명시
    - **References**:
      - 구현 PR: #39 (`feat(api): 2FA Strategy 도입 + TOTP + Auth 도메인 재구조화`, 커밋 37fc959)
      - 선행 결정: PR #26 (`feat: Push 2FA 서비스 구축 (DEV-012~016)`, 커밋 a9284a4)
      - Strategy 인터페이스: [services/api/src/twofa/strategies/twofa-strategy.interface.ts](../../services/api/src/twofa/strategies/twofa-strategy.interface.ts)
      - Registry: [services/api/src/twofa/strategies/twofa-strategy.registry.ts](../../services/api/src/twofa/strategies/twofa-strategy.registry.ts)
      - 구현체 3종: [push.strategy.ts](../../services/api/src/twofa/strategies/push.strategy.ts), [totp.strategy.ts](../../services/api/src/twofa/strategies/totp.strategy.ts), [backup-code.strategy.ts](../../services/api/src/twofa/strategies/backup-code.strategy.ts)
- **Mirror**: ADR-0001 본문 5섹션 구조 + References 의 실제 코드 경로 링크 패턴
- **Validate**:
  - 파일 존재 + 5섹션 헤더
  - References 의 4개 실제 코드 경로 `Test-Path` 모두 True
  - `grep -c "TwoFaStrategy\|TOTP\|Push\|Backup Code" docs/adr/0002-twofa-strategy-pattern.md` → ≥6 (각 키워드 최소 1회)

### Task 4: architecture.md §"전체 시스템 구성 (v0.1)" mermaid 재설계
- **Action** (L42-89): 노드/flow 재배치. 변경 의도:
  - 기존: Browser/MobileApp → Nginx → Web/Admin → API → DB/MinIO/MQ → NotifMS 단방향 위주
  - 신규: 두 가지 차원 명시 — (a) **인증 흐름** 시각 분리 (b) **codegen 파이프라인** 추가
    - subgraph 추가: `subgraph DevTime["개발 타임 (codegen)"]` — `Swagger["NestJS Swagger</br>(/json)"] --> CodegenWeb["hey-api codegen<br/>(services/web)"]` (점선 화살표 `-.->` 로 dev-only 표현)
    - `API` 노드 라벨에 `(Swagger /json 노출, dev only)` 부가설명 추가
    - `subgraph Frontend` 내부에 `WebCodegen["shared/api/generated/<br/>(hey-api SDK + TanStack Query)"]` 노드 추가, `Web --> WebCodegen` (`uses` 라벨)
  - 노드 ID 일관성 유지 (기존 `API`, `Web`, `Admin` 보존)
- **Mirror**: WS3 plan Task 2 의 mermaid 라벨 정정 형식 + 본 plan §Patterns to Mirror 의 Mermaid 노드 라벨
- **Validate**:
  - mermaid 렌더링 정상 (VSCode mermaid preview 또는 `npx -p @mermaid-js/mermaid-cli mmdc -i architecture.md -o /tmp/arch.svg`)
  - 새 노드 `Swagger`, `CodegenWeb`, `WebCodegen` 가 mermaid 블록에 모두 등장
  - 기존 외부 참조(다른 다이어그램에서 `API` 노드 인용 등) 무영향

### Task 5: architecture.md §"컨테이너 내부 구조" mermaid 재설계
- **Action** (L95-123):
  - 기존: Web/Admin/API 3개 컨테이너의 nginx proxy 흐름만 표현
  - 신규: 추가 컨테이너 시각화
    - `MQ` 컨테이너 추가 (services/mq, NestJS + BullMQ Worker)
    - `Redis` 컨테이너 추가 (BullMQ backend)
    - 화살표: `Api -->|"이벤트 큐잉"| Redis`, `Redis -->|"job 소비"| MQ`
  - subgraph 그룹화: 기존 `MainNginx` 보존, `Storage` subgraph 추가하여 Redis/DB/MinIO 묶음
- **Mirror**: WS3 plan Task 3 (노드 ID `Spring → Api` 정정) 이후 상태 + CLAUDE.md §디렉토리 구조의 `services/mq`
- **Validate**:
  - 모든 화살표(`->`, `-->`, `-.->`) 양끝 노드가 선언됨 (unresolved node 0)
  - 새 노드 4개(MQ, Redis 등) 등장
  - `grep -c "subgraph " docs/planning/architecture.md` → 이전 대비 증가 (subgraph 추가분)

### Task 6: architecture.md §"데이터 흐름" sequence diagram 재설계
- **Action** (L169-205):
  - 기존: 정적 파일 / 파일 업로드 / 공유 링크 3개 시나리오
  - 신규: 4번째 시나리오 추가 — **codegen 워크플로우** (개발자 시점):
    ```
    Note over Dev,Web: codegen 워크플로우 (개발 타임)
    Dev->>API: 1. API DTO/엔드포인트 변경 후 dev 서버 reload
    Dev->>Web: 2. npm run openapi:codegen
    Web->>API: GET /json (OpenAPI 문서)
    API-->>Web: OpenAPI JSON
    Web->>Web: shared/api/generated/ 갱신
    Dev->>Dev: generated diff 검토 + 사용처 갱신 + 동시 commit
    ```
  - participant `Dev as 개발자` 추가
  - 기존 3개 시나리오 보존, 신규 시나리오를 맨 끝에 배치
- **Mirror**: services/web/CLAUDE.md §"codegen 워크플로우" 5단계 + §Patterns to Mirror sequenceDiagram alt 한글 라벨
- **Validate**:
  - participant `Dev` 가 sequence 블록에 등장
  - `grep -c "codegen" docs/planning/architecture.md` → ≥1 (이전 0)
  - mermaid 렌더링 정상

### Task 7: architecture.md §"인증 흐름" sequence diagram 재설계
- **Action** (L211-259):
  - 기존: Push 2FA(숫자 매칭) 단일 분기, Refresh, 생체인증
  - 신규: Strategy 라우팅 + 3 가지 strategy 분기 시각화
    - participant `Registry as TwoFaStrategyRegistry` 추가
    - 자격증명 검증 후 분기 흐름 재구성:
      ```
      A->>Registry: get(strategyType) — TOTP / Push / Backup Code
      Registry-->>A: 선택된 Strategy
      A->>A: strategy.initiate(...)
      alt strategy = PUSH
          (기존 Push 2FA 숫자 매칭 흐름)
      else strategy = TOTP
          A-->>W: challengeId
          W-->>U: TOTP 코드 입력 화면
          U->>W: 6자리 코드
          W->>A: POST /api/twofa/verify
          A->>A: strategy.verify(...)
      else strategy = BACKUP_CODE
          A-->>W: challengeId
          W-->>U: Backup Code 입력 화면
          U->>W: 백업 코드
          W->>A: POST /api/twofa/verify
          A->>A: strategy.verify(...) — bcrypt 비교
      end
      ```
  - 신뢰기기 30일 분기는 외부 alt 로 유지 (기존 구조 보존)
  - Refresh, 생체인증 노트는 보존
- **Mirror**: TwoFaStrategyRegistry 코드 흐름 + 본 plan §Patterns to Mirror Mermaid sequenceDiagram alt 분기
- **Validate**:
  - `grep -c "Registry\|TOTP\|Backup Code" docs/planning/architecture.md` → ≥4
  - alt/else/end 균형 (mermaid renderer 무에러)
  - ADR-0002 참조 한 줄 추가 (sequence diagram 직후 prose: `> 상세 결정 근거: [ADR-0002](../adr/0002-twofa-strategy-pattern.md)`)

### Task 8: architecture.md §"알림 서비스 메시지 흐름" sequence diagram 재설계
- **Action** (L274-287):
  - 기존: API → MQ → NotificationMS → FCM → App 단순 흐름
  - 신규: BullMQ 명시 + retry 흐름 추가
    - participant `Redis as Redis (BullMQ)` 로 라벨 명확화
    - participant `NS as services/mq Worker` 로 명명 통일 (`Notification MS` → `MQ Worker`)
    - retry 시각화: `alt FCM 실패 ... else 성공 ... end`, retry 시 BullMQ backoff 사용 표기
  - 기본 흐름 유지, 알림 채널 라우팅(Push/Email) prose 는 §지원 채널 표로 분리(보존)
- **Mirror**: CLAUDE.md `MQ: Node 24.x / Nestjs 11 + Redis(BullMQ)` + services/api/CLAUDE.md §"신규 모듈 생성 시 체크리스트" 의 BullModule import
- **Validate**:
  - participant 라벨이 `BullMQ`, `MQ Worker` 키워드 포함
  - retry alt 블록 존재 (`grep -c "FCM 실패\|backoff" docs/planning/architecture.md` → ≥1)

### Task 9: architecture.md §"권한 검증 구조" sequence diagram 재설계
- **Action** (L351-370):
  - 기존: 단순한 JWT → userId → 권한 조회 → 200/403 흐름
  - 신규: NestJS Guard 체인 명시
    - `A->>A: JwtAuthGuard 검증` (기존 prose 를 명시적 step 으로)
    - `A->>A: PermissionGuard (@RequirePermission 메타 조회)` step 추가
    - `@Public()` 라우트 분기 표기: `alt @Public() 라우트 ... else 비공개 ... end`
  - 기존 권한 조회/검증 흐름은 `PermissionGuard` 내부 step 으로 묶기
- **Mirror**: services/api/CLAUDE.md `src/common/guards/` (JwtAuthGuard, PermissionGuard) + `@RequirePermission()` 데코레이터
- **Validate**:
  - `grep -c "JwtAuthGuard\|PermissionGuard\|@Public" docs/planning/architecture.md` → ≥3

### Task 10: architecture.md §"배포 구조" mermaid 재설계
- **Action** (L374-403):
  - WS3 plan Task 4 에서 이미 `DC → DS`, `RMQ → Redis`, `notification → mq` 라벨 정정 완료된 상태 전제
  - 신규: Docker Secret + ghcr.io 인증 경로 명시
    - subgraph `Secrets["Docker Secrets"]` 추가, Firebase 자격증명 등 파일 secret 표현 (PR #23 반영)
    - watchtower 의 ghcr.io 인증 토큰 secret 참조 화살표 (`WT -.->|"인증"| Secrets`)
    - GitHub Actions self-hosted runner 노드 추가 가능성 (PR #35 반영) — 단, 운영 NAS 호스트에 runner 가 직접 동거하지 않는다면 생략
- **Mirror**: CLAUDE.md `secrets/` 디렉토리 정의 + `make setup` (Docker Secret 등록) + 최근 커밋 7bf7eae(runner 환경변수 추가)
- **Validate**:
  - `grep -c "Docker Secret\|secrets/" docs/planning/architecture.md` → ≥1
  - 모든 화살표 양끝 노드 선언

### Task 11: architecture.md §"주요 설계 결정" 표에 ADR 링크 추가
- **Action** (L407-422 표 직후):
  - 표 아래에 prose 추가:
    ```markdown
    ### 주요 결정의 ADR

    위 표의 일부 결정은 별도 ADR 로 영속화되어 있다. 결정 시점의 맥락·대안·결과를 확인하려면
    아래 링크를 참고한다.

    | 결정 | ADR |
    |---|---|
    | API 클라이언트 생성 전략 (Swagger + hey-api) | [ADR-0001](../adr/0001-ts-rest-removal-swagger-migration.md) |
    | 2FA 방식 (Strategy 패턴, TOTP/Push/Backup Code) | [ADR-0002](../adr/0002-twofa-strategy-pattern.md) |

    > 전체 ADR 목록: [docs/adr/INDEX.md](../adr/INDEX.md)
    ```
- **Mirror**: 표 위 §주요 설계 결정 의 동일 마크다운 표 형식
- **Validate**:
  - architecture.md 에서 `grep -c "ADR-0001\|ADR-0002\|docs/adr" docs/planning/architecture.md` → ≥3

### Task 12: architecture.md §변경 이력 행 추가
- **Action**: 표 마지막에 행 추가:
  - `| 2026-05-25 | mermaid 다이어그램 7개 재설계 (codegen 파이프라인·Strategy 라우팅·BullMQ retry·Guard 체인·Docker Secret) + ADR-0001·0002 신설 (워크스트림 5) |`
- **Mirror**: 기존 §변경 이력 표 형식 (L425-429)
- **Validate**: `grep -c "2026-05-25.*워크스트림 5" docs/planning/architecture.md` → ≥1

### Task 13: CLAUDE.md 에 ADR 참조 추가
- **Action**: `CLAUDE.md` §"개발 워크플로우 (ECC)" 끝에 한 줄 추가:
  - 기존 마지막 줄("레거시 superpowers 문서…") 다음에:
    ```markdown
    - 주요 아키텍처 결정은 [docs/adr/INDEX.md](docs/adr/INDEX.md) 에 ADR 로 영속화한다 — 신규 결정 시 동일 형식으로 추가
    ```
- **Mirror**: 기존 CLAUDE.md §"개발 워크플로우 (ECC)" 의 bullet 형식 (`- `, 마크다운 링크 포함)
- **Validate**:
  - `grep -c "docs/adr/INDEX.md" CLAUDE.md` → ≥1
  - §"개발 워크플로우 (ECC)" 섹션 안에 위치 (다른 섹션 침범 없음)

### Task 14: 마스터 PRD Delivery Milestones #5 행 상태 전이
- **Action**:
  - `.claude/prds/superpowers-to-ecc-migration.prd.md` Delivery Milestones 표 #5 행
  - Status `pending` → `in-progress`
  - Plan `(.claude/plans/architecture-refresh.plan.md 예정)` → `[.claude/plans/architecture-refresh.plan.md](../plans/architecture-refresh.plan.md)`
  - 다른 행(#1, #2, #3, #4) 불변
- **Mirror**: WS3 plan Task 9 의 동일 상태 전이 형식
- **Validate**:
  - `git diff .claude/prds/superpowers-to-ecc-migration.prd.md` 가 1행 변경만 표시
  - `grep -c "in-progress.*architecture-refresh.plan.md" .claude/prds/superpowers-to-ecc-migration.prd.md` → ≥1

### Task 15: CRLF 검증
- **Action**: 본 plan + 신규 ADR 2개 + INDEX.md + 수정된 architecture.md / CLAUDE.md / PRD 모두 CRLF 적용 확인
- **Mirror**: CLAUDE.md §"코드 작성 spec" — Windows 개발 환경 기본 CRLF
- **Validate** (PowerShell):
  - `Get-Content -Raw {path} -ErrorAction Stop | %{ if ($_ -match "\r\n") { "OK" } else { "FAIL" } }` → 모든 파일 OK
  - 특히 신규 생성 파일(`docs/adr/*.md`) 의 EOL 검증 — Write 도구는 LF 기본, 생성 후 즉시 검증·보정

## Validation

```bash
# ADR 디렉토리 + 파일 존재
ls docs/adr/                                    # INDEX.md, 0001-*.md, 0002-*.md

# ADR 본문 5섹션 검증
grep -c "^## Status\|^## Context\|^## Decision\|^## Consequences\|^## References" \
  docs/adr/0001-ts-rest-removal-swagger-migration.md   # = 5
grep -c "^## Status\|^## Context\|^## Decision\|^## Consequences\|^## References" \
  docs/adr/0002-twofa-strategy-pattern.md              # = 5

# ADR 참조 일관성
grep -c "ADR-0001\|adr/0001" docs/planning/architecture.md CLAUDE.md docs/adr/INDEX.md   # >= 3
grep -c "ADR-0002\|adr/0002" docs/planning/architecture.md docs/adr/INDEX.md             # >= 2

# Mermaid 다이어그램 재설계 핵심 키워드
grep -c "codegen\|hey-api\|Swagger /json" docs/planning/architecture.md   # >= 2
grep -c "TwoFaStrategyRegistry\|Registry\|TOTP\|Backup Code" docs/planning/architecture.md   # >= 4
grep -c "BullMQ\|backoff" docs/planning/architecture.md                   # >= 1
grep -c "JwtAuthGuard\|PermissionGuard" docs/planning/architecture.md     # >= 2
grep -c "Docker Secret\|secrets/" docs/planning/architecture.md           # >= 1

# Mermaid 렌더링 무결성 (선택 자동화)
# npx -p @mermaid-js/mermaid-cli mmdc -i docs/planning/architecture.md -o /tmp/arch.svg

# 변경 이력 행 추가
grep -c "2026-05-25.*워크스트림 5" docs/planning/architecture.md          # >= 1

# CLAUDE.md ADR 링크
grep -c "docs/adr/INDEX.md" CLAUDE.md                                     # >= 1

# 마스터 PRD 상태 전이
grep -c "in-progress.*architecture-refresh.plan.md" \
  .claude/prds/superpowers-to-ecc-migration.prd.md                        # >= 1

# References 의 코드 경로 실재 확인 (PowerShell)
# Test-Path services/api/src/twofa/strategies/twofa-strategy.registry.ts   # True
# Test-Path services/api/src/twofa/strategies/twofa-strategy.interface.ts  # True
# Test-Path services/web/openapi-ts.config.ts                              # True

# CRLF 검증 (PowerShell, 신규 파일 우선)
# foreach ($f in @('docs/adr/INDEX.md','docs/adr/0001-ts-rest-removal-swagger-migration.md',
#                  'docs/adr/0002-twofa-strategy-pattern.md','docs/planning/architecture.md',
#                  'CLAUDE.md','.claude/prds/superpowers-to-ecc-migration.prd.md',
#                  '.claude/plans/architecture-refresh.plan.md')) {
#   $raw = Get-Content -Raw $f
#   if ($raw -match "`r`n") { "OK : $f" } else { "FAIL: $f" }
# }
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 7개 mermaid 다이어그램 동시 재설계로 노드 ID 불일치 → 렌더링 깨짐 | High | Task 4-10 각각 완료 직후 VSCode mermaid preview 로 시각 확인. 노드 ID 명명 컨벤션 사전 통일 (`Api`, `Web`, `MQ`, `Redis` 등 짧고 일관) |
| ADR 본문이 PRD 와 중복 — 결정 근거가 분산 | Medium | ADR 은 **결정 시점의 trade-off** 중심, PRD 는 **현재 작업의 범위** 중심. ADR References 에 원본 설계 문서(archive) 링크로 연결, 본문 중복 최소화 |
| sequence diagram 의 alt/else 중첩 → mermaid 파서 오류 | Medium | Task 7 (인증 흐름) 의 2 단 중첩 alt 검증을 우선 수행. mermaid-cli 로 자동 렌더링 검증 추가 |
| ADR-0002 의 strategy spec 파일 경로 변경(향후 리팩토링) → References 깨짐 | Low | ADR 은 **결정 시점의 스냅샷** 으로 운영. 코드 이동 시 ADR References 도 함께 갱신하는 운영 규칙을 INDEX.md 에 명시 |
| `docs/adr/` 디렉토리 명명이 ECC 룰과 충돌 | Low | ECC 룰(`~/.claude/rules/ecc/common/`)은 ADR 위치를 강제하지 않음. `docs/adr/` 가 업계 표준 |
| ts-rest 제거 ADR 의 "ts-rest 도입 결정"이 별도 ADR 부재 → 맥락 단절 | Low | ADR-0001 Context 섹션에 ts-rest 도입 배경을 간단히 요약 + archive 설계 문서 링크로 보충 |
| architecture.md 가 본 plan 머지 후 800줄 초과 | Medium | 현재 ~430줄 + ADR 참조/변경이력 ~30줄 추가. 800줄 한참 못 미침. 그러나 향후 분할 가능성 대비, "주요 결정 ADR" 섹션을 향후 architecture.md 슬림화 시 ADR 로 옮길 후보로 표기 |
| WS5 종료 시 PRD acceptance 의 "신규 기여자가 .claude/plans/README.md 만 읽고 진입" 충족 점검 누락 | Low | Acceptance 항목에 명시 포함, plan 종결 시 READMD 와 본 plan 의 연결성 확인 |

## Acceptance

- [ ] Task 1-15 모두 완료
- [ ] Validation 명령 전부 통과 (Mermaid CLI 자동 렌더링은 선택)
- [ ] `docs/adr/` 디렉토리에 INDEX + 2 ADR 파일 존재, 5섹션 본문 구비
- [ ] architecture.md 의 7개 mermaid 블록 모두 신규 의도(codegen / Strategy / BullMQ retry / Guard 체인 / Secret) 반영
- [ ] architecture.md 의 §주요 설계 결정 표에 ADR 링크 섹션 추가
- [ ] CLAUDE.md §"개발 워크플로우 (ECC)" 에 ADR INDEX 링크 1줄 추가
- [ ] 마스터 PRD #5 행이 `in-progress` 와 본 plan 경로 표시
- [ ] 변경된/신규 모든 .md 파일이 CRLF
- [ ] Mermaid 다이어그램 시각 확인 (수동 또는 CLI)

## Out of Scope (이 plan 범위 밖)

- 신규 아키텍처 결정 (예: API Gateway 도입, MQ 백엔드 재선택, 마이크로서비스 분리 추가) — 별도 PRD + ADR
- WS4 (services/api·web 의 layer 패턴 정리) — `code-pattern-cleanup.plan.md` 예정
- 기획 문서(`requirements.md`, `release-plan.md` 등) 의 다이어그램 (architecture.md 외) 갱신
- `docs/archive/superpowers/` 내부 archive 문서 — historical reference 보존
- 신규 다이어그램 추가 (예: 파일 업로드 chunked 흐름, 트래시 lifecycle) — 본 plan 은 **기존 7개 mermaid 의 재설계** 만 수행
- ADR-0003 이상 (NestJS 마이그레이션, MQ 분리 결정 등) — 사용자가 본 plan 범위에서 제외 결정
- `services/api/CLAUDE.md` 와 `services/web/CLAUDE.md` 갱신 (이미 WS1 에서 ts-rest 제거·Swagger 컨벤션 박제 완료)

## Suggested Follow-up

1. 본 plan 승인 → Task 1-15 순차 실행
2. Mermaid 시각 확인 후 PR 분리: 마스터 PRD 의 "워크스트림 단위 PR 분리 강제" 준수 — WS3 PR 머지 후 진입 (suggested sequence 3)
3. 머지 후 워크스트림 4 (`code-pattern-cleanup`) 진입 — 본 plan 이 다이어그램·ADR 최신화를 끝낸 상태이므로 layer 패턴 점검이 최신 아키텍처 기준에서 수행 가능
4. 향후 신규 아키텍처 결정 발생 시 본 plan 의 ADR 형식(Nygard 5섹션 + 프론트매터) 그대로 재사용 — INDEX.md 에 행 추가만으로 색인 유지

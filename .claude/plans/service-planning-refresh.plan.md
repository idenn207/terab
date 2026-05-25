# Plan: 서비스 기획 최신화 (Spring → NestJS 격차 해소)

**Source PRD**: [.claude/prds/superpowers-to-ecc-migration.prd.md](../prds/superpowers-to-ecc-migration.prd.md)
**Selected Milestone**: #3 — 서비스 기획 최신화 (Spring → NestJS 격차 해소)
**Complexity**: Medium

## Summary

`docs/planning/` 의 architecture·release-plan·requirements 3개 문서가 Spring Boot/Java 21·Spring Security·RabbitMQ·Flyway·Docker Compose 스택으로 기록돼 있으나 실제 구현은 NestJS 11·Passport JWT·Redis(BullMQ)·Drizzle·Docker Swarm 으로 이미 전환됐다. 본 plan은 기획 문서의 스택 라벨을 실측 구현과 일치시키는 **사실 정정**만 수행한다. 다이어그램 구조 재설계·ADR 신규 작성·신규 아키텍처 결정은 워크스트림 5 또는 별도 PRD로 분리한다.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| 스택 표기 단위 | [CLAUDE.md](../../CLAUDE.md) 프로젝트 개요 표 | `Node 24.x / Nestjs 11 + Drizzle`, `Node 24.x / Nestjs 11 + Redis(BullMQ)` 형식을 그대로 사용 (괄호 안 의존성·버전 표기) |
| 디렉토리 명명 | [CLAUDE.md](../../CLAUDE.md) §디렉토리 구조 | `services/api`, `services/mq`, `services/web`, `services/nginx` — 기획 문서의 `notification/` 명칭은 `mq/`로 정정 |
| 변경 이력 표기 | [docs/planning/release-plan.md:328-332](../../docs/planning/release-plan.md#L328-L332) §변경 이력 표 | `| YYYY-MM-DD | 변경 내용 |` 표 마지막 행에 추가. 기존 표 형식 유지 |
| Mermaid 노드 라벨 | [docs/planning/architecture.md:59](../../docs/planning/architecture.md#L59) | `Name["라벨<br/>(부가설명)"]` 패턴 보존, 따옴표 안 텍스트만 교체 |
| PRD 마일스톤 상태 전이 | [.claude/plans/docs-ecc-realignment.plan.md:83-86](docs-ecc-realignment.plan.md#L83-L86) Task 7 | `pending → in-progress`, Plan 컬럼에 본 plan 경로 기록 |

## Files to Change

| File | Action | Why |
|---|---|---|
| `docs/planning/architecture.md` | UPDATE | API Gateway 로드맵, 시스템 구성 mermaid, 컨테이너 내부 구조 mermaid, 배포 구조 mermaid, 일반 prose 5+군데에 Spring/Java/RabbitMQ/Docker Compose 잔존 |
| `docs/planning/release-plan.md` | UPDATE | DEV-002 (Flyway), DEV-003 (Spring Security), DEV-007 (Spring Boot + RabbitMQ), DEV-041 (Docker Compose + rabbitmq) 4개 행 정정 |
| `docs/planning/requirements.md` | UPDATE | §인프라 구조 디렉토리 트리 L153 (`Spring Boot 백엔드`), L157 (`notification/ # ...`) 정정 |
| `.claude/prds/superpowers-to-ecc-migration.prd.md` | UPDATE | Delivery Milestones 표의 #3 행: `pending → in-progress`, Plan 컬럼에 본 plan 경로 기록 |
| `docs/planning/milestones.md` | KEEP | 기능·범위 문서로 스택 미언급 (`grep -i "spring\|java\b" milestones.md` → 0건 확인) |
| `docs/planning/screens/**`, `service-overview.md`, `personas.md`, `user-flow.md`, `user-stories.md`, `screen-spec.md`, `information-architecture.md` | KEEP | grep 결과 스택 키워드 없음 |

## Tasks

### Task 1: architecture.md §"API Gateway 로드맵" 정정
- **Action**: L28 셀 `Spring Cloud Gateway 또는 Nginx 기반` → `Nginx 기반 (또는 NestJS Gateway 패턴)` 으로 교체. 향후 결정 사항은 별도 PRD에서 다루므로 옵션만 제시
- **Mirror**: CLAUDE.md 의 "API"·"MQ" 표기 (Nestjs 11 명시)
- **Validate**: `grep -n "Spring Cloud" docs/planning/architecture.md` → 0

### Task 2: architecture.md §"전체 시스템 구성 (v0.1)" mermaid 정정
- **Action**:
  - L59 `API["Spring Boot API<br/>(Java 21)<br/>드라이브 + 관리자 API 공용"]` → `API["NestJS API<br/>(Node 24 / NestJS 11)<br/>드라이브 + 관리자 API 공용"]`
  - 알림 흐름 mermaid의 `MQ["Message Queue"]` 는 일반어이므로 보존, 단 §"알림 서비스 아키텍처"의 "Message Queue" 설명 prose에 `Redis(BullMQ)` 명시
- **Mirror**: CLAUDE.md "API: Node 24.x / Nestjs 11 + Drizzle"
- **Validate**:
  - `grep -n "Spring Boot API" docs/planning/architecture.md` → 0
  - mermaid 렌더링 검증: VSCode mermaid preview 또는 `npx -p @mermaid-js/mermaid-cli mmdc -i architecture.md -o /tmp/out.svg` (선택)

### Task 3: architecture.md §"컨테이너 내부 구조" mermaid 정정
- **Action**:
  - L116 `Spring["Spring Boot :8080"]` → `Api["NestJS :8080"]`
  - L121-122 `ApiProxy --> Spring`, `AApiProxy --> Spring` → `ApiProxy --> Api`, `AApiProxy --> Api` (노드 ID 일관성)
  - L165 `proxy_pass http://api:8080` 은 실제 nginx.conf 와 일치하므로 보존
- **Mirror**: services/api 컨테이너 실제 포트 (`services/api/CLAUDE.md` 또는 docker-compose/swarm 파일 확인 후 결정)
- **Validate**:
  - `grep -n "Spring Boot :8080\| Spring " docs/planning/architecture.md` → 0
  - mermaid 노드 ID 참조 깨짐 없음 (mermaid 렌더링 시 unresolved node 에러 없음)

### Task 4: architecture.md §"배포 구조" mermaid 정정
- **Action**:
  - L377 `subgraph DC["Docker Compose"]` → `subgraph DS["Docker Swarm"]`. 이후 `DC --> ...` 참조 모두 `DS`로 치환
  - L381 `API["api<br/>(Spring Boot)"]` → `API["api<br/>(NestJS 11)"]`
  - L384 `RMQ["rabbitmq<br/>(Message Queue)"]` → `Redis["redis<br/>(BullMQ)"]`. 노드 ID `RMQ → Redis` 일관 치환
  - `NotifMS["notification<br/>(Notification MS)"]` → `MQ["mq<br/>(MQ Worker / BullMQ)"]`. CLAUDE.md 의 서비스 명명 `services/mq/` 와 일치
  - 노드 ID 치환에 따른 화살표 (`->`, `-->`) 모두 갱신
- **Mirror**: CLAUDE.md 운영 섹션 (`make stack` = Docker Swarm), `MQ: Node 24.x / Nestjs 11 + Redis(BullMQ)`
- **Validate**:
  - `grep -in "docker compose\|rabbitmq\|Spring" docs/planning/architecture.md` → 0
  - mermaid 그래프에 미해결 노드 ID 없음 (모든 `-->` 양끝 노드가 선언됨)

### Task 5: architecture.md prose 정정
- **Action**:
  - L16 `별도 Docker Compose 또는 별도 컨테이너` → `별도 Docker Stack 또는 별도 컨테이너` (Swarm 용어)
  - §"인증 흐름"·"권한 검증 구조" mermaid 의 `JWT`·`bcrypt` 등은 실제 구현과 부합하므로 보존
- **Mirror**: CLAUDE.md "인프라: Docker Swarm + Nginx"
- **Validate**: `grep -in "docker compose" docs/planning/architecture.md` → 0 또는 history 섹션만

### Task 6: release-plan.md DEV-002·003·007·041 4개 행 정정
- **Action**:
  - L45 DEV-002 비고 `Flyway 마이그레이션` → `Drizzle 마이그레이션`. 항목명 `DB 스키마 설계 + Flyway 마이그레이션` → `DB 스키마 설계 + Drizzle 마이그레이션`
  - L46 DEV-003 비고 `bcrypt, Spring Security` → `bcrypt, NestJS Passport JWT Strategy`
  - L61 DEV-007 비고 `Spring Boot + RabbitMQ` → `NestJS 11 + Redis(BullMQ)`. 항목명은 `Notification MS 구축` 유지 (의미 동일)
  - L139 DEV-041 항목명 `Docker Compose 통합` → `Docker Swarm 통합`. 비고 `admin, notification, rabbitmq` → `admin, mq, redis`
- **Mirror**: CLAUDE.md 의 스택 표기
- **Validate**:
  - `grep -in "Flyway\|Spring Security\|Spring Boot\|RabbitMQ" docs/planning/release-plan.md` → 0
  - DEV ID 번호와 의존성 표(L240-) 무영향 (행 추가/삭제 없음)

### Task 7: requirements.md §"인프라 구조" 정정
- **Action**:
  - L153 `├── api/          # Spring Boot 백엔드 (드라이브 + 관리자 API 공용)` → `├── api/          # NestJS 11 백엔드 (드라이브 + 관리자 API 공용)`
  - L157 `├── notification/ # Notification MS (MQ 기반 Push/Email 전송)` → `├── mq/           # MQ 서비스 (NestJS + BullMQ Worker, Push/Email 전송)`
  - 디렉토리 정렬 폭(`├── ` 뒤 공백) 기존 트리와 일치 유지
- **Mirror**: CLAUDE.md §디렉토리 구조 (실제 `services/mq/` 사용)
- **Validate**:
  - `grep -in "Spring Boot" docs/planning/requirements.md` → 0
  - `grep -n "├── mq/" docs/planning/requirements.md` → 1

### Task 8: 각 문서 §변경 이력 표에 행 추가
- **Action**: architecture.md / release-plan.md / requirements.md 각 §변경 이력 표 마지막 행에 다음 추가
  - `| 2026-05-25 | NestJS 11 / Redis(BullMQ) / Drizzle / Docker Swarm 스택으로 정정 (워크스트림 3) |`
  - architecture.md 에는 §변경 이력 섹션이 없으므로 문서 맨 끝에 `## 변경 이력` 표 신설 (release-plan.md 형식 그대로 재사용)
- **Mirror**: release-plan.md L327-332 §변경 이력 표
- **Validate**: 세 문서 모두 마지막 변경 이력 행에 `2026-05-25` 와 `워크스트림 3` 키워드 포함

### Task 9: 마스터 PRD Delivery Milestones #3 행 상태 전이
- **Action**:
  - `.claude/prds/superpowers-to-ecc-migration.prd.md` Delivery Milestones 표 #3 행
  - Status `pending` → `in-progress`
  - Plan `(.claude/plans/service-planning-refresh.plan.md 예정)` → `.claude/plans/service-planning-refresh.plan.md`
  - 다른 행(#1, #2, #4, #5)은 건드리지 않음
- **Mirror**: ECC `/ecc:plan` command spec — "update only the selected row from pending to in-progress"
- **Validate**: PRD diff 가 #3 행 1줄 변경에 한정 (다른 행, frontmatter, 다른 섹션 무변경)

### Task 10: CRLF 검증
- **Action**: 본 plan과 수정된 모든 문서에 CRLF 적용 확인
- **Mirror**: CLAUDE.md §"코드 작성 spec" — Windows 개발 환경 기본 CRLF
- **Validate**: PowerShell `Get-Content -Raw {path} | %{ if ($_ -match "\r\n") { "OK" } else { "FAIL: $_" } }` → 모두 OK

## Validation

```bash
# 스택 잔존 키워드 0건 확인
grep -rin "Spring\|Java 21\|Flyway\|RabbitMQ\|Spring Security\|Spring Cloud" docs/planning/
# 결과: 0건 (또는 변경 이력 표의 history 문구만)

grep -rin "Docker Compose\|docker-compose" docs/planning/architecture.md docs/planning/release-plan.md
# 결과: 0건

# NestJS 스택 명시 확인
grep -c "NestJS\|Drizzle\|BullMQ\|Docker Swarm" docs/planning/architecture.md   # >= 4
grep -c "NestJS\|Drizzle\|BullMQ\|Docker Swarm" docs/planning/release-plan.md   # >= 4
grep -c "NestJS" docs/planning/requirements.md                                   # >= 1

# 변경 이력 표 행 추가 확인
grep -c "2026-05-25" docs/planning/architecture.md   # >= 1
grep -c "2026-05-25" docs/planning/release-plan.md   # >= 1
grep -c "2026-05-25" docs/planning/requirements.md   # >= 1

# 마스터 PRD 상태 전이 확인
grep -c "in-progress.*service-planning-refresh.plan.md" .claude/prds/superpowers-to-ecc-migration.prd.md   # >= 1

# Mermaid 렌더링 무결성 (선택)
# VSCode mermaid preview 또는 mermaid-cli 로 SVG 출력 후 시각 확인

# CRLF 검증 (PowerShell)
# Get-Content -Raw docs/planning/architecture.md | Select-String "`r`n" | Measure-Object | %{ $_.Count }
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mermaid 노드 ID 일괄 치환 시 일부 화살표 양끝 노드 ID 불일치 → 렌더링 깨짐 | High | Task 4 완료 후 mermaid preview 로 시각 확인 또는 `grep "[-=]>" architecture.md` 로 노드 ID 양끝 점검 |
| `notification/` → `mq/` 정정이 다른 문서에서 참조 깨짐 유발 | Medium | `grep -rn "services/notification\|notification/" docs/ services/` 전수 검사 후 발견 시 같은 PR 에서 함께 정정 |
| 워크스트림 5 (아키텍처 정리) 와 범위 충돌 — 다이어그램 일부를 미리 손대게 됨 | Medium | 본 plan 은 **라벨 텍스트 교체**만 수행, 노드 추가·삭제·flow 재배치 금지. 워크스트림 5 가 구조 재설계 담당 |
| bcrypt 등 일부 라이브러리 표기를 무리하게 NestJS-specific 으로 바꾸면 사실 왜곡 | Medium | bcrypt·JWT 등 NestJS 에서도 동일하게 사용하는 라이브러리는 보존. Spring-only(Spring Security, Flyway, Spring Cloud) 만 교체 |
| `Docker Compose` 표현이 일반어로 쓰인 곳(L16)까지 무리하게 교체 | Low | 운영 배포 맥락(L377 mermaid)에서만 `Docker Swarm`, 일반어 맥락은 `Docker Stack` 또는 보존 |
| 마스터 PRD 행 수정 시 표 외 영역까지 의도치 않게 변경 | Low | `git diff .claude/prds/superpowers-to-ecc-migration.prd.md` 가 1행 변경만 보여야 함 |
| Java/Spring 검색이 §변경 이력 history 문구까지 잡아 후속 grep false positive | Low | grep 결과 검토 시 §변경 이력 표 안 history 문구 허용. validation 명령에 `--invert-match` 또는 컨텍스트 확인 |

## Acceptance

- [ ] Task 1-10 모두 완료
- [ ] Validation 명령 전부 통과
- [ ] `grep -rin "Spring\|Flyway\|RabbitMQ" docs/planning/` 결과가 §변경 이력 history 라인 제외 0건
- [ ] 마스터 PRD #3 행이 `in-progress` 와 본 plan 경로 표시
- [ ] 변경된 모든 .md 파일이 CRLF 인코딩
- [ ] 변경된 문서 mermaid 가 정상 렌더링 (시각 확인 또는 자동 검증)

## Out of Scope (이 plan 범위 밖)

- 새로운 아키텍처 결정 (예: API Gateway 도입 시점, MQ 백엔드 선택 재검토) — 별도 PRD
- mermaid 다이어그램 노드 추가/삭제, flow 재배치 → 워크스트림 5
- 신규 ADR 작성 (2FA Strategy 결정, ts-rest 제거 결정 등) → 워크스트림 5
- `services/api`·`services/web` 의 layer 패턴 정리 → 워크스트림 4
- 화면 사양 문서(`screens/**`) 갱신 — 스택 미언급으로 정정 불필요
- `docs/archive/superpowers/` 내부 archive 문서 — historical reference 로 깨진 채 허용 (마스터 PRD risk 항목)
- 신규 다이어그램 작성 (예: 2FA Strategy 흐름) → 워크스트림 5

## Suggested Follow-up

1. 본 plan 승인 → Task 1-10 순차 실행 (모두 텍스트 편집이라 1세션 내 완결 가능)
2. PR 분리: 마스터 PRD에 명시된 "워크스트림 단위 PR 분리 강제" 준수 — 워크스트림 1+2 PR과 별도 PR
3. 머지 후 워크스트림 5 (`/ecc:plan .claude/prds/superpowers-to-ecc-migration.prd.md`) 진입 — 본 plan이 라벨 정정 끝낸 상태이므로 워크스트림 5 는 다이어그램 재설계·ADR 신규 작성에 집중 가능

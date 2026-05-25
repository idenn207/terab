---
name: superpowers-to-ecc-migration
description: superpowers 플러그인 기반 워크플로우를 ECC 표준으로 전환하고 누적된 문서·기획·코드 패턴·아키텍처를 정합화
status: in-progress
created: 2026-05-25
---

# PRD: Superpowers → ECC 마이그레이션 (마스터)

## Problem

지난 6주간 `superpowers` 플러그인의 `plans/specs/finish-plans/finish-specs` 4분면 문서 체계로 80+개의 설계·구현 문서가 누적되었다. 플러그인 자체는 이미 `.claude/settings.json` 에서 비활성화되고 `ecc@ecc` 가 활성화됐으나, 다음 격차가 남아 있다.

1. **워크플로우 격차**: 신규 작업이 ECC 표준 흐름(`/ecc:plan-prd → /ecc:plan → /ecc:prp-implement`)을 따르는지가 코드/팀 컨벤션 어디에도 명시되지 않음
2. **문서 격차**: 완료된 문서가 `finish-*` 폴더에 누적된 채 ECC의 `.claude/prds/`, `.claude/plans/` 구조와 분리됨 — 향후 작업에서 검색·참조 일관성 깨짐
3. **기획 격차**: `docs/planning/architecture.md`·`release-plan.md` 등이 Spring Boot/Java 21로 기록되어 있으나 실제 스택은 NestJS 11 — 기획↔구현 괴리 누적
4. **패턴 격차**: `services/api`, `services/web` 의 layer 패턴(controller/service/repository/schema)이 ECC 룰(`.claude/rules/`)에 부합하는지 점검·정리 미수행
5. **아키텍처 격차**: Mermaid 다이어그램·ADR이 최신 구현(2FA Strategy, ts-rest 제거, Swagger 전환 등)을 반영하지 못함

## Hypothesis

5개 워크스트림을 PRD 마일스톤으로 분리하고 ECC 표준 흐름으로 단계적 처리하면, (a) 문서·코드 정합성이 회복되고 (b) 신규 기여자가 단일 명령(`/ecc:plan-prd`)으로 작업을 시작할 수 있어 (c) superpowers 시절의 문서 누적이 재발하지 않는다.

## Scope

### In Scope

- superpowers `finish-plans` `finish-specs` `plans` `specs` 4개 디렉토리 전체 → `docs/archive/superpowers/{plans,specs}/` 통합
- 신규 문서 작성 시 ECC 산출물 디렉토리(`.claude/prds/`, `.claude/plans/`) 사용 표준화
- `docs/planning/*` 의 Spring Boot → NestJS 격차 해소
- `services/api`, `services/web` 의 layer 패턴 ECC 룰 부합도 점검
- 아키텍처 다이어그램·ADR 최신화

### Out of Scope

- 코드 기능 변경 (워크스트림 4 리팩토링은 패턴 정리에 한정, 기능 추가/제거 없음)
- 데이터베이스 마이그레이션
- CI/CD 파이프라인 변경
- 신규 기능 개발

## Glossary

`CLAUDE.md` 의 도메인 용어 표를 그대로 승계. 신규 PRD/Plan은 동일 영문 식별자 사용.

| 한글     | 영문 (코드) | 설명                                    |
| -------- | ----------- | --------------------------------------- |
| 파일     | File        | 사용자가 업로드한 개별 파일             |
| 폴더     | Folder      | 파일을 담는 디렉토리 단위               |
| 드라이브 | Drive       | 사용자에게 할당된 최상위 저장 공간      |
| 사용자   | User        | 서비스 계정                             |
| 권한     | Permission  | 파일/폴더에 대한 접근 권한              |
| 역할     | Role        | RBAC 기반 사용자 역할                   |
| 공유     | Share       | 파일/폴더를 타 사용자에게 공유하는 행위 |

## Acceptance

- 모든 5개 워크스트림 milestone 이 `done` 상태
- `docs/superpowers/` 디렉토리 부재 (전체 `docs/archive/superpowers/` 로 이전)
- `CLAUDE.md` 가 ECC 표준 흐름을 명시하고 superpowers 미언급 (archive 참조 제외)
- `docs/planning/architecture.md` 가 NestJS 11 스택을 정확히 반영
- 신규 기여자가 `.claude/plans/README.md` 만 읽고 표준 흐름 진입 가능

## Delivery Milestones

| # | Workstream | Status | Plan | Priority |
|---|---|---|---|---|
| 1 | superpowers → ECC 워크플로우 위임 (CLAUDE.md 갱신, README 작성, 워크플로우 표준화) | in-progress | `.claude/plans/docs-ecc-realignment.plan.md` | High |
| 2 | 기존 문서 ECC 구조 정합화 (archive 이전, INDEX, frontmatter 컨벤션) | in-progress | `.claude/plans/docs-ecc-realignment.plan.md` | High |
| 3 | 서비스 기획 최신화 (Spring → NestJS 격차 해소) | in-progress | [.claude/plans/service-planning-refresh.plan.md](../plans/service-planning-refresh.plan.md) | High |
| 4 | 코드 패턴 정리/재구조화 (services/api·web layer 룰 부합 점검) | pending | (`.claude/plans/code-pattern-cleanup.plan.md` 예정) | Medium |
| 5 | 아키텍처 정리 (다이어그램·ADR 최신화) | in-progress | [.claude/plans/architecture-refresh.plan.md](../plans/architecture-refresh.plan.md) | Medium |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 워크스트림 4 리팩토링이 진행 중인 기능 PR과 충돌 | High | 워크스트림 4를 마지막으로 배치, sprint 경계에 맞춰 진행 |
| 워크스트림 3 기획 최신화가 코드 변경 유도 (예: API Gateway 도입 결정) | Medium | 기획 갱신은 "현재 상태 기록"만 수행, 신규 결정은 별도 PRD 분리 |
| ECC 표준 흐름이 superpowers 대비 학습 곡선 발생 | Low | `.claude/plans/README.md` 가이드로 완화, 기존 archive 참조 가능 |
| `finish-*` 이동 시 archived 문서 내부 상대경로 깨짐 | Medium | archive 내부 문서는 historical reference로만 사용, 깨진 링크 허용 (수정 비용 > 가치) |
| 한 PR에 5개 워크스트림 모두 묶으면 리뷰 불가 | High | 워크스트림 단위 PR 분리 강제 |

## Suggested Sequence

1. **워크스트림 1+2 (현재)**: 문서 정합화 — 한 PR
2. **워크스트림 3**: 기획 최신화 — 별도 PR (별도 `/ecc:plan` 호출)
3. **워크스트림 5**: 아키텍처 정리 — 워크스트림 3 머지 후 (다이어그램은 최신 기획 의존)
4. **워크스트림 4**: 코드 패턴 정리 — 가장 큰 작업, 별도 sprint

## References

- 직접 plan: [.claude/plans/docs-ecc-realignment.plan.md](../plans/docs-ecc-realignment.plan.md)
- 워크플로우 가이드: [.claude/plans/README.md](../plans/README.md)
- 도메인 컨벤션: [CLAUDE.md](../../CLAUDE.md)
- 레거시 아카이브: `docs/archive/superpowers/INDEX.md` (워크스트림 2 산출)

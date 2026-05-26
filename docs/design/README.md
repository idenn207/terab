---
name: docs-design-readme
description: services/web 디자인 산출물 디렉토리 색인 및 archive 정책
status: done
created: 2026-05-26
---

# docs/design/

services/web 의 디자인 결정·시각 설계·UseCase 시나리오를 보존하는 디렉토리.

## 목적

- Phase 1 Design Spike 의 의사결정 근거를 영속화
- Phase 2~10 도메인 슬라이스 작업이 참조할 단일 reference 출처
- 후일 디자인 방향 재검토 시 평가표·점수의 비교 baseline

## 산출물 색인

| 문서 | 목적 |
|---|---|
| [direction.md](direction.md) | 디자인 방향 4 후보 평가 + 채택 + 모바일-퍼스트 적용 가이드 |
| [component-catalog.md](component-catalog.md) | Catalyst 제거 + headlessui primitive 기반 자체 컴포넌트 카탈로그 |
| [wireframes.md](wireframes.md) | drive / login / upload-flow / preview 4 화면 모바일+데스크톱 와이어프레임 |
| [usecases.md](usecases.md) | UseCase 시나리오 5~7 개 (Phase 6 E2E 입력) |

## Archive 정책

이 디렉토리의 문서는 **archive 대상 아님**.

- 이유: design 결정은 후행 phase 가 참조하는 살아있는 reference. 후일 디자인 방향 재검토 시 기존 평가 점수·근거를 직접 갱신.
- Plan 산출물(`docs/archive/superpowers/plans/` 이전 대상)과 구분.
- 디자인 방향이 변경될 경우 새 문서를 만들지 않고 `direction.md` 의 Decisions Log 에 행 추가 + 채택안 갱신.

## 상호 참조

- 상위 PRD: [.claude/prds/services-web-feature-parity.prd.md](../../.claude/prds/services-web-feature-parity.prd.md)
- 실행 Plan: [.claude/plans/services-web-feature-parity-phase1-design-spike.plan.md](../../.claude/plans/services-web-feature-parity-phase1-design-spike.plan.md)
- FSD 컨벤션: [services/web/CLAUDE.md](../../services/web/CLAUDE.md)

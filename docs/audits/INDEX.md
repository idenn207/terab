# Audits

이 디렉토리는 코드·문서·아키텍처의 특정 시점 스냅샷(audit)을 보관한다. audit 는 **그 시점의 사실** 을 기록하는 evidence base 이며, 이후 사실이 바뀌어도 갱신하지 않는다 — 재발 시 신규 audit 파일(`{topic}-audit-YYYY-MM.md`) 을 새로 추가한다.

audit 는 PRD/Plan 과 다음과 같이 결합한다:

| 산출물 | 역할 |
|---|---|
| PRD (`.claude/prds/`) | 왜 / 무엇을 / 수용 조건 |
| Plan (`.claude/plans/`) | 어떻게 / Task / 검증 |
| Audit (`docs/audits/`) | 특정 시점의 사실 — Plan 의 작업 범위 결정 evidence |
| ADR (`docs/adr/`) | 결정 시점의 trade-off — 결정이 굳어진 뒤 박제 |

## 목록

| # | 제목 | 날짜 | 상태 |
|---|---|---|---|
| 1 | [코드 패턴 audit 2026-05](code-pattern-audit-2026-05.md) | 2026-05-25 | complete |

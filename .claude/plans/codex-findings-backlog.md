# Codex Findings Backlog

DEFER_TO_BACKLOG 로 분류된 Codex 발견 항목. 형식: 날짜 | severity | 출처 plan | 한 줄 요약

2026-07-22 | MEDIUM | .claude/plans/network-storage-reframing-phase3-hardening.plan.md | F4 마이그레이션이 app init 중 실행 — CREATE UNIQUE INDEX / DROP CONSTRAINT 의 락·다운타임 거동 미검증 (database.service.ts:35)
2026-07-22 | MEDIUM | .claude/plans/network-storage-reframing-phase3-hardening.plan.md | F8 pii-masker 가 osPassword/chapPassword 를 누락 — StorageAgentClient 경로에선 도달 불가하나 "로그 안전" 주장 범위가 좁음 (pii-masker.ts:7)
2026-07-22 | LOW | .claude/plans/network-storage-reframing-phase3-hardening.plan.md | F13 다른 codegen 우회 잔존 (trash-purge/usePurgeTrashItem.ts:23, file-search/api/query.ts:23) — Task 4 범위 밖 drift 부채
2026-07-22 | HIGH | .claude/plans/network-storage-reframing-phase3-hardening.plan.md | G3 revoke() 가 외부 정리(deleteTarget+secret)를 DB softRevoke 앞에 실행 — DB 실패 시 active-but-target-missing 창(재-revoke 로 self-heal). revoke() 재정렬은 별도 plan (service.ts:117)

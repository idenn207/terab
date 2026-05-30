---
name: admin-users-pagination
description: PR #70 review M-3 후속 — admin 사용자 목록 페이지에 pagination UI 추가 + users 테이블에 soft-delete(deletedAt) 컬럼 도입 시 list/count 양쪽 필터링 박제. 현재 default limit=50 만 호출해 51번째 사용자부터 노출 안 됨.
status: pending
created: 2026-05-30
---

# Plan: admin 사용자 목록 pagination + soft-delete 필터링 (PR #70 review M-3 후속)

> **Source review**: [.claude/reviews/pr-70-review.md](../reviews/pr-70-review.md) — M-3
> **Predecessor plan**: [.claude/plans/admin-m3-pr70-review-fix.plan.md](./admin-m3-pr70-review-fix.plan.md)
> **Complexity**: Small ~ Medium

## Summary

services/admin 의 `AdminUsersPage` 가 pagination 컨트롤 없이 default `limit=50` 만 호출 — NAS 환경의 user 수가 50 이하라는 *암묵 전제* 가 코드 어디에도 박제되지 않음. 추가로 services/api 의 `user.repository.ts` 의 `SELECT count(*) FROM users` 가 unbounded + soft-delete 컬럼 여부 무관 — `users.deletedAt` 도입 시 inconsistent total 위험. UI prev/next + items-per-page + (soft-delete 도입 시) deletedAt IS NULL 필터링.

## Tasks

TBD on activation:

1. `services/admin/src/pages/admin/users/ui/AdminUsersPage.tsx` — pagination 컨트롤 추가 (URL query state)
2. `services/api/src/user/user.repository.ts` 의 `listUsers` + `count` — `users.deletedAt IS NULL` 필터링 (도입 후)
3. `services/api/src/user/dto/list-users-query.dto.ts` — page 기반 API 표면 검토 (limit/offset 유지 vs page/per-page 전환)
4. spec/E2E — 페이지 이동·총 개수 표시·빈 페이지 케이스

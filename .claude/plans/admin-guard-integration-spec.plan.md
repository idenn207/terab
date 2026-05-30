---
name: admin-guard-integration-spec
description: PR #70 review M-1 후속 — admin 컨트롤러의 PermissionGuard 동작을 검증하는 supertest 기반 통합/E2E spec 1~2건 추가. 현재 admin 컨트롤러 spec 은 controller method 만 unit 검증 — `user:read` 권한 없는 사용자가 `/admin/users` 호출 시 403 같은 *행동* 미검증.
status: pending
created: 2026-05-30
---

# Plan: admin 컨트롤러 PermissionGuard 통합 spec 추가 (PR #70 review M-1 후속)

> **Source review**: [.claude/reviews/pr-70-review.md](../reviews/pr-70-review.md) — M-1
> **Predecessor plan**: [.claude/plans/admin-m3-pr70-review-fix.plan.md](./admin-m3-pr70-review-fix.plan.md)
> **Complexity**: Small

## Summary

PR #70 admin 컨트롤러 spec 은 모두 `Test.createTestingModule({ controllers, providers })` 기반 unit test 로 PermissionGuard / JwtAuthGuard 가 wiring 되지 않은 상태에서 controller method 를 직접 호출한다. 즉 admin endpoint 의 권한 게이트(`user:read` / `user:invite` / `user:manage`) 가 실제 요청 흐름에서 작동하는지 검증 부재. supertest 기반 E2E 또는 `Test.createTestingModule({ providers: [JwtAuthGuard, PermissionGuard, ...] })` 통합 spec 1~2건 추가로 guard 우회 가능성(decorator 누락·등록 순서 오류) 회귀 차단.

## Tasks

TBD on activation — 우선순위 후보:

1. `services/api/test/admin.e2e-spec.ts` 신설 — supertest 기반 `/admin/users` 의 403/200 케이스
2. 또는 `services/api/src/admin/admin-guard.spec.ts` 통합 spec — `Test.createTestingModule` 에 실제 Guard 등록

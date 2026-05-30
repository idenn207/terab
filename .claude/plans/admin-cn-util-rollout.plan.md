---
name: admin-cn-util-rollout
description: PR #70 review M-6 후속 — services/admin 의 `AdminLayout.tsx:30` NavLink className 의 template literal + ternary 조합을 `cn()` 유틸로 통일. mobile-ui-guide §6.3 / web/coding-style.md 위반 해소.
status: pending
created: 2026-05-30
---

# Plan: AdminLayout NavLink className `cn()` 유틸 통일 (PR #70 review M-6 후속)

> **Source review**: [.claude/reviews/pr-70-review.md](../reviews/pr-70-review.md) — M-6
> **Predecessor plan**: [.claude/plans/admin-m3-pr70-review-fix.plan.md](./admin-m3-pr70-review-fix.plan.md)
> **Related rule**: [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) §6.3
> **Complexity**: Trivial (한 줄)

## Summary

[services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx:30](../../services/admin/src/widgets/admin-layout/ui/AdminLayout.tsx#L30) 의 `className={({ isActive }) => \`${NAV_LINK_BASE_CLASS} ${isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_INACTIVE_CLASS}\`}` 를 `cn(NAV_LINK_BASE_CLASS, isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_INACTIVE_CLASS)` 로 교체. M-5 (admin-zinc-to-token-migration) 와 동일 sprint 권장 — 같은 컴포넌트 surface.

## Tasks

TBD on activation:

1. `AdminLayout.tsx:30` 한 줄 교체
2. snapshot 회귀 점검 (rendered className 동일성)
3. (선택) services/admin 전체 grep 으로 template literal + ternary 잔존 호출처 동시 정리

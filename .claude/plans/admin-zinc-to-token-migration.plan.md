---
name: admin-zinc-to-token-migration
description: PR #70 review M-5 후속 — services/admin 신규 컴포넌트(InviteDialog, UserListTable, AdminUsersPage, AdminLayout)의 raw Tailwind zinc 팔레트(`bg-zinc-*`/`text-zinc-*`/`dark:bg-zinc-*`) 를 mobile-ui-guide §6.2 token utility 로 일괄 교체.
status: pending
created: 2026-05-30
---

# Plan: admin 신규 컴포넌트 zinc → token utility 일괄 교체 (PR #70 review M-5 후속)

> **Source review**: [.claude/reviews/pr-70-review.md](../reviews/pr-70-review.md) — M-5
> **Predecessor plan**: [.claude/plans/admin-m3-pr70-review-fix.plan.md](./admin-m3-pr70-review-fix.plan.md)
> **Related rule**: [.claude/rules/ecc/web/mobile-ui-guide.md](../rules/ecc/web/mobile-ui-guide.md) §6.2
> **Complexity**: Small

## Summary

PR #70 의 모든 admin 신규 컴포넌트가 `bg-zinc-50/100/200/...`, `text-zinc-500/700/900/...`, `bg-white`, `dark:bg-zinc-900/950` 등 Tailwind 기본 zinc 팔레트 + raw hex tone 만 사용. mobile-ui-guide §6.2 는 "zinc-* 는 catalyst 잔존 사용처에서만 허용. 신규 컴포넌트는 token utility 만" 명시. M3 완료 후 catalyst 일괄 교체 sprint 와 묶어 surface, text, border, accent semantic token 으로 일괄 교체. M-6 (admin-cn-util-rollout) 와 같은 sprint 권장 — 둘 다 동일 admin 컴포넌트 surface.

## Tasks

TBD on activation:

1. services/admin 의 [`InviteDialog.tsx`, `UserListTable.tsx`, `AdminUsersPage.tsx`, `AdminLayout.tsx`] 의 zinc/raw color → tokens.css token utility 치환
2. light/dark mode 양쪽 contrast 4.5:1 검증 (axe-core)
3. visual regression 스냅샷 (`services/admin/__snapshots__/`) 갱신 + 시각 diff review

import { expect, test } from '@playwright/test';

// PR #62 의 e2e 도입 — 본 PR 은 시나리오 A 만 실제 작성한다.
// B~E 는 후속 plan/PR 에서 충실화 (메모리 [[project_auth_lifecycle_pr62_in_progress]] 참조).
test.describe('auth flows', () => {
  test('A: /login?error=2fa_failed 진입 시 banner alert 1회 + URL cleanup', async ({ page }) => {
    await page.goto('/login?error=2fa_failed');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('2단계 인증에 실패했습니다. 다시 로그인해주세요.');

    // setSearchParams({}, { replace: true }) 로 query 만 제거. pathname 은 /login 유지.
    await expect(page).toHaveURL(/\/login$/);
  });

  // 후속 PR 에서 작성 — 본 PR 의 scope 는 codegen + cast 제거 + Playwright 도입 + 시나리오 A.
  test.skip('B: 모바일 push 클릭 시 /2fa/:id modal overlay 표시', () => {});
  test.skip('C: 모바일 logout 후 PC 로그인 시 그 모바일 push 미수신', () => {});
  test.skip('D: 모바일 미로그아웃 종료 → 재시작 → /drive 직진 (AppShell silent refresh boot guard)', () => {});
  test.skip('E: 모바일 첫 로그인 trust 체크 → PC 로그인 시 2FA 스킵', () => {});
});

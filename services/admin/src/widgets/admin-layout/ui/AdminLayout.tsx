import { useLogout } from '@/features';
import { Button, Heading } from '@/shared/ui';
import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  const { logout } = useLogout();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Heading level={1} className="text-base font-semibold">
          terab admin
        </Heading>
        <Button onClick={logout} plain className="text-sm">
          로그아웃
        </Button>
      </header>
      <div className="flex grow">
        <nav aria-label="admin navigation" className="w-56 border-r bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-900">
          {/* M3 에서 사용자 목록 / 초대 메뉴 채움 */}
          <span>사이드바 (M3)</span>
        </nav>
        <main className="grow p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

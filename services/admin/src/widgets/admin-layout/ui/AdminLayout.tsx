import { useLogout } from '@/features';
import { Button, Heading } from '@/shared/ui';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_LINK_BASE_CLASS =
  'block rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950';
const NAV_LINK_INACTIVE_CLASS = 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
const NAV_LINK_ACTIVE_CLASS = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900';

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
        <nav aria-label="admin navigation" className="w-56 border-r bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <ul className="flex flex-col gap-1">
            <li>
              <NavLink to="/admin/users" className={({ isActive }) => `${NAV_LINK_BASE_CLASS} ${isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_INACTIVE_CLASS}`}>
                사용자
              </NavLink>
            </li>
          </ul>
        </nav>
        <main className="grow p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

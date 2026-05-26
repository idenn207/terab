import { useMeQuery } from '@/entities';
import { LogoUrl } from '@/shared/assets';
import { DriveSidebar } from '@/widgets';
import * as Headless from '@headlessui/react';
import { Bars3Icon, BellIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';

const userNavigation = [
  { name: '내 프로필', href: '/settings/profiles' },
  { name: '계정 설정', href: '/settings' },
  { name: '로그아웃', href: '#' },
];

export function DriveLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: user } = useMeQuery();
  const nickname = user?.nickname ?? '...';

  return (
    <div>
      <DriveSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-20">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-xs sm:gap-x-6 sm:px-6 lg:px-8 dark:border-white/10 dark:bg-gray-900 dark:shadow-none dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:bg-black/10">
          <button type="button" onClick={() => setSidebarOpen(true)} className="-m-2.5 p-2.5 text-gray-700 lg:hidden dark:text-gray-400">
            <span className="sr-only">사이드바 열기</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>

          <div aria-hidden="true" className="h-6 w-px bg-gray-900/10 lg:hidden dark:bg-white/10" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <form action="#" method="GET" className="grid flex-1 grid-cols-1">
              <input
                name="search"
                type="search"
                placeholder="검색 (Phase 9 에서 활성화 예정)"
                aria-label="검색"
                disabled
                title="Phase 9 에서 활성화 예정"
                className="col-start-1 row-start-1 block size-full bg-white pl-8 text-base text-gray-900 outline-hidden placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm/6 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
              />
              <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 size-5 self-center text-gray-400" />
            </form>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <button type="button" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:hover:text-white">
                <span className="sr-only">알림 보기</span>
                <BellIcon aria-hidden="true" className="size-6" />
              </button>

              <div aria-hidden="true" className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10 dark:lg:bg-white/10" />

              <Headless.Menu as="div" className="relative">
                <Headless.MenuButton className="relative flex items-center">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">사용자 메뉴 열기</span>
                  <img
                    alt=""
                    src={LogoUrl}
                    className="size-8 rounded-full bg-gray-50 outline -outline-offset-1 outline-black/5 dark:bg-gray-800 dark:outline-white/10"
                  />
                  <span className="hidden lg:flex lg:items-center">
                    <span aria-hidden="true" className="ml-4 text-sm/6 font-semibold text-gray-900 dark:text-white">
                      {nickname}
                    </span>
                    <ChevronDownIcon aria-hidden="true" className="ml-2 size-5 text-gray-400 dark:text-gray-500" />
                  </span>
                </Headless.MenuButton>
                <Headless.MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-gray-900/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  {userNavigation.map((item) => (
                    <Headless.MenuItem key={item.name}>
                      <a
                        href={item.href}
                        className="block px-3 py-1 text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5"
                      >
                        {item.name}
                      </a>
                    </Headless.MenuItem>
                  ))}
                </Headless.MenuItems>
              </Headless.Menu>
            </div>
          </div>
        </div>

        <main className="xl:pl-96">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

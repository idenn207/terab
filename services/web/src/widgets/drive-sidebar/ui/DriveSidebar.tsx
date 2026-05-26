import { LogoUrl } from '@/shared/assets';
import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import { DRIVE_NAV_ITEMS } from '../model/navigation';

interface DriveSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DriveSidebar({ isOpen, onClose }: DriveSidebarProps) {
  const { pathname } = useLocation();

  return (
    <>
      <Headless.Dialog open={isOpen} onClose={onClose} className="relative z-50 lg:hidden">
        <Headless.DialogBackdrop transition className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-closed:opacity-0" />

        <div className="fixed inset-0 flex">
          <Headless.DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full"
          >
            <Headless.TransitionChild>
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5 duration-300 ease-in-out data-closed:opacity-0">
                <button type="button" onClick={onClose} className="-m-2.5 p-2.5">
                  <span className="sr-only">사이드바 닫기</span>
                  <XMarkIcon aria-hidden="true" className="size-6 text-white" />
                </button>
              </div>
            </Headless.TransitionChild>

            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-2 ring-1 ring-white/10">
              <div className="flex h-16 shrink-0 items-center">
                <img alt="로고" src={LogoUrl} className="h-8 w-auto" />
              </div>
              <nav className="flex flex-1 flex-col" aria-label="모바일 사이드바">
                <ul role="list" className="-mx-2 flex-1 space-y-1">
                  {DRIVE_NAV_ITEMS.map((item) => {
                    const isCurrent = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={cn(
                            isCurrent ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                            'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                          )}
                        >
                          <item.icon aria-hidden="true" className="size-6 shrink-0" />
                          {item.name}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </Headless.DialogPanel>
        </div>
      </Headless.Dialog>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-20 lg:overflow-y-auto lg:bg-gray-900 lg:pb-4 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:border-r dark:before:border-white/10 dark:before:bg-black/10">
        <div className="relative flex h-16 shrink-0 items-center justify-center">
          <img alt="로고" src={LogoUrl} className="h-8 w-auto" />
        </div>
        <nav className="relative mt-8" aria-label="데스크탑 사이드바">
          <ul role="list" className="flex flex-col items-center space-y-1">
            {DRIVE_NAV_ITEMS.map((item) => {
              const isCurrent = pathname === item.href;
              return (
                <li key={item.name}>
                  <a
                    href={item.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      isCurrent ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white',
                      'group flex gap-x-3 rounded-md p-3 text-sm/6 font-semibold',
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-6 shrink-0" />
                    <span className="sr-only">{item.name}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}

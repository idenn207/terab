import { ChevronRightIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router-dom';

interface SettingsItem {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const SETTINGS_ITEMS: readonly SettingsItem[] = [
  {
    href: '/settings/devices',
    icon: DevicePhoneMobileIcon,
    title: '신뢰기기',
    description: '2단계 인증을 우회할 수 있는 신뢰기기를 관리합니다.',
  },
] as const;

export function SettingsPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
      <section data-region="main" aria-label="설정 메뉴" className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">설정</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">계정 보안과 기기 관리 등 설정을 변경합니다.</p>
        </header>
        <ul role="list" className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
          {SETTINGS_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                aria-label={item.title}
                className="flex items-center gap-x-4 px-4 py-4 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-white/5"
              >
                <item.icon aria-hidden="true" className="size-6 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
                </div>
                <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-gray-300 dark:text-gray-600" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

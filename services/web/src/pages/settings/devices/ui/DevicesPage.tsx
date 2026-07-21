import { TrustedDeviceSection } from '@/features';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export function DevicesPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
      <section data-region="main" aria-label="신뢰기기 관리" className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
            설정
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">신뢰기기</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">2단계 인증을 우회할 수 있도록 등록된 기기 목록입니다. 의심스러운 항목은 해제하세요.</p>
        </header>
        <TrustedDeviceSection />
      </section>
    </div>
  );
}

import { TrashList } from '@/widgets';

export function TrashPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
      <section data-region="main" aria-label="휴지통 콘텐츠" className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">휴지통</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">삭제된 파일과 폴더를 복원하거나 영구 삭제할 수 있어요.</p>
        </header>
        <TrashList />
      </section>
    </div>
  );
}

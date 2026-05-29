import { useTrashList } from '../model/useTrashList';
import { TrashItemRow } from './TrashItemRow';

const SKELETON_COUNT = 4;

export function TrashList() {
  const { items, isLoading, error, isEmpty } = useTrashList();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
          <div key={idx} className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
        ))}
        <span className="sr-only">휴지통 목록을 불러오는 중</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        휴지통 목록을 불러올 수 없습니다: {error.message}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">휴지통이 비어 있어요</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">삭제한 파일과 폴더는 이곳에 보관되며, 30일 이내 복원할 수 있어요.</p>
      </div>
    );
  }

  return (
    <ul role="list" className="flex flex-col gap-3" aria-label="휴지통 항목 목록">
      {items.map((item) => (
        <TrashItemRow key={`${item.type}-${item.id}`} item={item} />
      ))}
    </ul>
  );
}

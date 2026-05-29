import type { TrashItem } from '@/entities/trash';
import { PurgeButton, RestoreButton } from '@/features';
import { DocumentIcon, FolderIcon } from '@heroicons/react/24/outline';

interface TrashItemRowProps {
  item: TrashItem;
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function TrashItemRow({ item }: TrashItemRowProps) {
  const Icon = item.type === 'folder' ? FolderIcon : DocumentIcon;
  const typeLabel = item.type === 'folder' ? '폴더' : '파일';

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-1 items-center gap-3 truncate">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <div className="flex flex-col truncate">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="sr-only">{`${typeLabel}, 삭제된 시각`}</span>
            {dateFormatter.format(new Date(item.deletedAt))}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RestoreButton itemId={item.id} itemType={item.type} itemName={item.name} />
        <PurgeButton itemId={item.id} itemType={item.type} itemName={item.name} />
      </div>
    </li>
  );
}

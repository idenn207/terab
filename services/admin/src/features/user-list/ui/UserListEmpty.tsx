interface UserListEmptyProps {
  onInviteClick?: () => void;
}

export function UserListEmpty({ onInviteClick }: UserListEmptyProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-md border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">아직 등록된 사용자가 없습니다.</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">초대 링크를 생성하여 첫 사용자를 추가하세요.</p>
      {onInviteClick && (
        <button
          type="button"
          onClick={onInviteClick}
          className="mt-1 inline-flex items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950"
        >
          사용자 초대
        </button>
      )}
    </div>
  );
}

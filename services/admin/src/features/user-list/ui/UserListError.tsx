interface UserListErrorProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function UserListError({ onRetry, isRetrying }: UserListErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/50 dark:bg-red-950/30"
    >
      <p className="text-base font-medium text-red-700 dark:text-red-300">사용자 목록을 불러오지 못했습니다.</p>
      <p className="text-sm text-red-600/80 dark:text-red-400/80">잠시 후 다시 시도해 주세요.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-1 inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 dark:focus-visible:ring-offset-zinc-950"
        >
          {isRetrying ? '재시도 중...' : '다시 시도'}
        </button>
      )}
    </div>
  );
}

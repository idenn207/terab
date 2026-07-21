import { useAdminUserListQuery } from '@/entities';
import { UserListEmpty } from './UserListEmpty';
import { UserListError } from './UserListError';
import { UserListTable } from './UserListTable';

interface UserListSectionProps {
  onInviteClick?: () => void;
}

export function UserListSection({ onInviteClick }: UserListSectionProps) {
  const { data, isLoading, isError, refetch, isFetching } = useAdminUserListQuery();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-zinc-200 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
      >
        사용자 목록을 불러오는 중...
      </div>
    );
  }

  if (isError || !data) {
    return <UserListError onRetry={() => void refetch()} isRetrying={isFetching} />;
  }

  if (data.items.length === 0) {
    return <UserListEmpty onInviteClick={onInviteClick} />;
  }

  return <UserListTable users={data.items} />;
}

import type { AdminUser } from '@/entities';

interface UserListTableProps {
  users: AdminUser[];
}

const LIST_FORMATTER = new Intl.ListFormat('ko-KR', { style: 'short', type: 'unit' });
const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function UserListTable({ users }: UserListTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">사용자 목록</caption>
        <thead className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              아이디
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              닉네임
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              역할
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              가입일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{user.username}</td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{user.nickname}</td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{user.roleNames.length > 0 ? LIST_FORMATTER.format(user.roleNames) : '—'}</td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{DATE_FORMATTER.format(new Date(user.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

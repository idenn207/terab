import { InviteDialog, UserListSection } from '@/features';
import { Heading } from '@/shared/ui';
import { useState } from 'react';

export function AdminUsersPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <section className="grid gap-6">
      <header className="flex items-center justify-between">
        <Heading level={1}>사용자</Heading>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950"
        >
          사용자 초대
        </button>
      </header>
      <UserListSection onInviteClick={() => setInviteOpen(true)} />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </section>
  );
}

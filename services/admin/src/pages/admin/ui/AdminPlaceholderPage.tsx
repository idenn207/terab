import { useUserStore } from '@/entities';
import { Heading } from '@/shared/ui';

export function AdminPlaceholderPage() {
  const nickname = useUserStore((s) => s.user?.nickname);

  return (
    <section className="grid gap-6">
      <Heading level={1}>terab admin 콘솔</Heading>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{nickname ? `${nickname}` : '관리자'}님, 환영합니다. M2 로그인이 완료되었습니다.</p>
      <p className="text-sm text-zinc-500">M3 에서 사용자 목록 / 초대 추가 예정.</p>
    </section>
  );
}

import { LoginForm } from '@/features';
import { Heading } from '@/shared/ui';

export function LoginPage() {
  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <span className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">terab admin</span>
      <Heading>로그인</Heading>
      <LoginForm />
    </div>
  );
}

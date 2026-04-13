import { LoginForm } from '@/features';
import { LogoLabel } from '@/shared/assets';
import { Heading } from '@/shared/ui';

export function LoginPage() {
  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>로그인</Heading>
      <LoginForm />
    </div>
  );
}

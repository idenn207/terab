import { LoginForm } from '@/features';
import { LogoLabel } from '@/shared/assets';
import { Heading } from '@/shared/ui';

export function LoginPage() {
  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="text-text h-6 forced-colors:text-[CanvasText]" />
      <Heading>로그인</Heading>
      <LoginForm />
    </div>
  );
}

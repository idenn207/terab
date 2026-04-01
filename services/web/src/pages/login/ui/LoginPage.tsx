import { LogoLabel } from '@/shared/assets';
import { Field, Heading, Input, Label } from '@/shared/ui';

export function LoginPage() {
  return (
    <form action="#" method="post" className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>로그인</Heading>
      <Field>
        <Label>아이디</Label>
        <Input type="text" name="userId" />
      </Field>
      <Field>
        <Label>비밀번호</Label>
        <Input type="password" name="password" />
      </Field>
    </form>
  );
}

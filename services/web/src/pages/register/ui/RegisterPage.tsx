import { RegisterForm, useInvitationValidation } from '@/features';
import { LogoLabel } from '@/shared/assets';
import { Heading } from '@/shared/ui';
import { useNavigate, useParams } from 'react-router-dom';

export function RegisterPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { valid } = useInvitationValidation(token);

  const handleSuccess = (backupCodes: string[]) => {
    navigate(`/register/${token}/backup`, { state: { backupCodes }, replace: true });
  };

  if (valid === null) {
    return (
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
        <p className="text-sm text-zinc-500">초대 링크를 확인하는 중...</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
        <p role="alert" className="text-sm text-red-500">
          유효하지 않은 초대 링크입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>회원가입</Heading>
      <RegisterForm token={token} onSuccess={handleSuccess} />
    </div>
  );
}

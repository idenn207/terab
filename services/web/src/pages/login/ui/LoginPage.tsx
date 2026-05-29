import { LoginForm } from '@/features';
import { LogoLabel } from '@/shared/assets';
import { Heading } from '@/shared/ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const ERROR_MESSAGES: Record<string, string> = {
  '2fa_failed': '2단계 인증에 실패했습니다. 다시 로그인해주세요.',
};

export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    const errorKey = searchParams.get('error');
    if (!errorKey) return;
    consumedRef.current = true;
    const text = ERROR_MESSAGES[errorKey];
    // URL query 진입 시 1회만 banner — consumedRef gate 로 idempotent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (text) setErrorMessage(text);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="grid w-full max-w-sm grid-cols-1 gap-8">
      <LogoLabel className="text-text h-6 forced-colors:text-[CanvasText]" />
      <Heading>로그인</Heading>
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      )}
      <LoginForm />
    </div>
  );
}

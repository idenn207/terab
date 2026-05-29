import { TrustThisDeviceCheckbox, useTrustedDevice } from '@/features/trusted-device';
import { Button, Heading } from '@/shared/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTwoFactorPolling } from '../model/useTwoFactorPolling';

export function TwoFactorWaiting() {
  const [trustChecked, setTrustChecked] = useState(false);
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get('id') ?? '';
  const navigate = useNavigate();
  const { register } = useTrustedDevice();
  const { correctNum, remainingSeconds, resend } = useTwoFactorPolling(challengeId, trustChecked ? register : undefined);

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <section className="gap-gutter flex w-full max-w-sm flex-col">
      <header className="flex flex-col gap-2">
        <Heading level={1}>Push 2FA</Heading>
        <p className="text-text-muted text-base">모바일 기기에서 아래 숫자를 선택해 주세요.</p>
      </header>

      <div
        aria-label={`승인 번호 ${correctNum}`}
        className="bg-surface-elevated text-text mx-auto flex h-32 w-32 items-center justify-center rounded-xl text-3xl font-semibold shadow-md"
      >
        {correctNum}
      </div>

      <p aria-live="polite" className="text-text-subtle text-center text-sm">
        남은 시간 {minutes}:{seconds}
      </p>

      <TrustThisDeviceCheckbox checked={trustChecked} onChange={setTrustChecked} />

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" onClick={resend} variant="outlined" tone="neutral">
          재전송
        </Button>
        <Button type="button" onClick={() => navigate('/login/backup')} variant="text" tone="neutral">
          백업 코드 사용
        </Button>
      </div>
    </section>
  );
}

import { Button, Heading, Text } from '@/shared/ui';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTwoFactorPolling, type ApprovedData } from '../model/useTwoFactorPolling';

interface TwoFactorWaitingProps {
  onApproved: (data: ApprovedData) => void;
}

export function TwoFactorWaiting({ onApproved }: TwoFactorWaitingProps) {
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get('id') ?? '';
  const navigate = useNavigate();
  const { correctNum, remainingSeconds, pollStatus, approvedData, resend } = useTwoFactorPolling(challengeId);

  useEffect(() => {
    if (pollStatus === 'approved' && approvedData) {
      onApproved(approvedData);
    }
  }, [pollStatus, approvedData, onApproved]);

  useEffect(() => {
    if (pollStatus === 'denied') {
      navigate('/login');
    }
  }, [pollStatus, navigate]);

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div className="flex flex-col">
      <Heading level={1} className="text-xl font-bold">
        Push 2FA
      </Heading>
      <Text className="text-center text-sm text-gray-600">모바일 기기에서 아래 숫자를 선택해 주세요.</Text>
      <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 text-4xl font-bold">
        {correctNum}
      </div>
      <Text className="text-sm text-gray-500">
        남은 시간: {minutes}:{seconds}
      </Text>
      <div className="flex gap-4 text-sm">
        <Button onClick={resend} className="text-blue-600 underline" plain>
          재전송
        </Button>
        <span>.</span>
        <Button onClick={() => navigate('/login/backup')} className="text-blue-600 underline" plain>
          백업 코드 사용
        </Button>
      </div>
    </div>
  );
}

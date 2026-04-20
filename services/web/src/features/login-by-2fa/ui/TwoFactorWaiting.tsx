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
  const { options, remainingSeconds, pollStatus, approvedData, resend } = useTwoFactorPolling(challengeId);

  useEffect(() => {
    if (pollStatus === 'approved' && approvedData) {
      onApproved(approvedData);
    }
  }, [pollStatus, approvedData, onApproved]);

  useEffect(() => {
    if (pollStatus === 'denied') {
      navigate('login');
    }
  }, [pollStatus, navigate]);

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div className="flex flex-col">
      <h1 className="text-xl font-bold">Push 2FA</h1>
      <p className="text-center text-sm text-gray-600">모바일 기기에서 아래 숫자 중 올바른 숫자를 선택해 주세요.</p>
      <div className="flex gap-4">
        {options.map((opt) => (
          <div key={opt} className="flex h-20 w-20 items-center justify-center rounded-lg border-2 text-2xl font-bold">
            {opt}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        남은 시간: {minutes}:{seconds}
      </p>
      <div className="flex gap-4 text-sm">
        <button onClick={resend} className="text-blue-600 underline">
          재전송
        </button>
        <span>.</span>
        <button onClick={() => navigate('/login/backup')} className="text-blue-600 underline">
          백업 코드 사용
        </button>
      </div>
    </div>
  );
}

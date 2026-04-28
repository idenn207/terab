import { useUserStore } from '@/entities';
import { type ApprovedData, TrustThisDeviceCheckbox, TwoFactorWaiting, useTrustedDevice } from '@/features';
import { Button, Text } from '@/shared/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function TwoFAWaitPage() {
  const { register } = useTrustedDevice();
  const [approvedData, setApprovedData] = useState<ApprovedData | null>(null);
  const [trustChecked, setTrustChecked] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);

  const handleComplete = async () => {
    if (!approvedData) return;
    setIsCompleting(true);
    try {
      setAuth(approvedData.accessToken, approvedData.user);
      if (trustChecked) {
        await register();
      }
      navigate('/drive');
    } finally {
      setIsCompleting(false);
    }
  };

  if (approvedData) {
    return (
      <div className="flex w-100 flex-col items-center gap-6 rounded-xl border p-8">
        <Text className="text-lg font-bold text-green-600">✓ 인증 성공</Text>
        <TrustThisDeviceCheckbox checked={trustChecked} onChange={setTrustChecked} />
        <Button className="w-full rounded-2xl bg-blue-600 py-2 text-white disabled:opacity-50" onClick={handleComplete} disabled={isCompleting}>
          {isCompleting ? '처리 중...' : '계속'}
        </Button>
      </div>
    );
  }

  return <TwoFactorWaiting onApproved={setApprovedData} />;
}

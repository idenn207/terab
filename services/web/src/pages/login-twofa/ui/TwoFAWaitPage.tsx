import { TwoFactorWaiting, useTrustedDevice } from '@/features';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function TwoFAWaitPage() {
  const { register } = useTrustedDevice();
  const [trustChecked, setTrustChecked] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();

  return <TwoFactorWaiting />;
}

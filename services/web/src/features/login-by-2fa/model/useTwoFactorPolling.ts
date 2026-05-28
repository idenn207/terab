import { useUserStore } from '@/entities';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompleteTwoFaMutation, useResendChallengeMutation } from '../api/mutation';
import { useChallengeStatusQuery } from '../api/query';

export function useTwoFactorPolling(initialChallengeId: string, onAuthenticated?: () => void) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [pollEnabled, setPollEnabled] = useState(true);
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const resendMutation = useResendChallengeMutation();
  const completeMutation = useCompleteTwoFaMutation();
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  const { data } = useChallengeStatusQuery(challengeId, pollEnabled);

  useEffect(() => {
    if (!data) return;

    if (data.status === 'DENIED' || data.status === 'EXPIRED') {
      setPollEnabled(false);
      navigate('/login?error=2fa_denied');
      return;
    }

    if (data.status === 'APPROVED') {
      setPollEnabled(false);
      completeMutation
        .mutateAsync({ path: { id: challengeId } })
        .then((completeRes) => {
          if (completeRes.status === 'AUTHENTICATED') {
            setAuth(completeRes.accessToken, completeRes.user);
            onAuthenticatedRef.current?.();
            navigate('/drive', { replace: true });
            return;
          }
          // 타입상 2FA_REQUIRED 분기 — completeTwoFa는 서버가 항상 AUTHENTICATED만 반환하지만
          // LoginResponse union 타입을 방어적으로 좁혀 실패로 처리.
          navigate('/login?error=2fa_failed');
        })
        .catch(() => navigate('/login?error=2fa_failed'));
    }
  }, [data, completeMutation, navigate, challengeId, setAuth]);

  const pendingData = data?.status === 'PENDING' ? data : null;

  const resend = async () => {
    resendMutation.mutate(
      { path: { id: challengeId } },
      {
        onSuccess: (response) => {
          if (response) {
            setChallengeId(response.challengeId);
            setPollEnabled(true);
          }
        },
      },
    );
  };

  return {
    options: pendingData?.options ?? [],
    correctNum: pendingData?.correctNum ?? '',
    remainingSeconds: pendingData?.remainingSeconds ?? 0,
    resend,
  };
}

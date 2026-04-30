import { useUserStore } from '@/entities';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompleteTwoFaMutation, useResendChallengeMutation } from '../api/mutation';
import { useChallengeStatusQuery } from '../api/query';

export function useTwoFactorPolling(initialChallengeId: string) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [pollEnabled, setPollEnabled] = useState(true);
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const resendMutation = useResendChallengeMutation();
  const completeMutation = useCompleteTwoFaMutation();

  const { data } = useChallengeStatusQuery(challengeId, pollEnabled);

  useEffect(() => {
    if (!data || data.status !== 200) return;
    const body = data.body;

    if (body.status === 'DENIED' || body.status === 'EXPIRED') {
      setPollEnabled(false);
      navigate('/login?error=2fa_denied');
      return;
    }

    if (body.status === 'APPROVED') {
      setPollEnabled(false);
      completeMutation
        .mutateAsync({ params: { id: challengeId }, body: {} })
        .then((completeRes) => {
          if (completeRes.status === 200 && completeRes.body.status === 'AUTHENTICATED') {
            setAuth(completeRes.body.accessToken, completeRes.body.user);
            navigate('/drive');
            return;
          }
        })
        .catch(() => navigate('/login?error=2fa_failed'));
    }
  }, [data]);

  const pendingData = data?.status === 200 && data.body.status === 'PENDING' ? data.body : null;

  const resend = async () => {
    resendMutation.mutate(
      { params: { id: challengeId }, body: {} },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            setChallengeId(response.body.challengeId);
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

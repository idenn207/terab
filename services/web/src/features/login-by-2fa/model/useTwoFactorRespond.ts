import { useEffect, useState } from 'react';
import { useRespondChallengeMutation } from '../api/mutation';
import { useChallengeStatusQuery } from '../api/query';

type RespondStatus = 'loading' | 'selecting' | 'done' | 'expired';

export function useTwoFactorRespond(challengeId: string) {
  const [respondStatus, setRespondStatus] = useState<RespondStatus>('loading');
  const respondMutation = useRespondChallengeMutation();

  const { data, isError } = useChallengeStatusQuery(challengeId, respondStatus === 'loading' || respondStatus === 'selecting');

  useEffect(() => {
    if (isError) {
      setRespondStatus('expired');
      return;
    }
    if (!data || data.status !== 200) return;
    if (data.body.status === 'PENDING') {
      setRespondStatus('selecting');
    } else {
      setRespondStatus('expired');
    }
  }, [data, isError]);

  const options = data?.status === 200 && data.body.status === 'PENDING' ? data.body.options : [];

  const respond = (selectedNumber: string) => {
    respondMutation.mutate(
      { params: { id: challengeId }, body: { selectedNumber } },
      {
        onSuccess: () => setRespondStatus('done'),
      },
    );
  };

  return { options, respondStatus, respond };
}

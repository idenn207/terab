import { useEffect, useState } from 'react';
import { twoFactorApi } from '../api/twoFactorApi';

type RespondStatus = 'loading' | 'selecting' | 'done' | 'expired';

export function useTwoFactorRespond(challengeId: string) {
  const [options, setOptions] = useState<string[]>([]);
  const [respondStatus, setRespondStatus] = useState<RespondStatus>('loading');

  useEffect(() => {
    twoFactorApi
      .getStatus(challengeId)
      .then((data) => {
        if (data.status === 'PENDING') {
          setOptions(data.options);
          setRespondStatus('selecting');
        } else {
          setRespondStatus('expired');
        }
      })
      .catch(() => setRespondStatus('expired'));
  }, [challengeId]);

  const respond = async (selectedNumber: string) => {
    await twoFactorApi.respond(challengeId, selectedNumber);
    setRespondStatus('done');
  };

  return { options, respondStatus, respond };
}

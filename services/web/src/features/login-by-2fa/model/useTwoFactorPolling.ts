import { useEffect, useRef, useState } from 'react';
import { twoFactorApi, type ChallengeStatus } from '../api/twoFactorApi';

const POLL_INTERVAL_MS = 3000; // 3초마다

type PollStatus = 'polling' | 'approved' | 'denied';

interface ApprovedData {
  accessToken: string;
  user: { id: string; username: string; nickname: string };
}

function useTwoFactorPolling(initialChallengeId: string) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [options, setOptions] = useState<string[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [pollStatus, setPollStatus] = useState<PollStatus>('polling');
  const [approvedData, setApprovedData] = useState<ApprovedData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const data: ChallengeStatus = await twoFactorApi.getStatus(challengeId);
        if (data.status === 'PENDING') {
          setOptions(data.options);
          setRemainingSeconds(data.remainingSeconds);
        } else if (data.status === 'APPROVED') {
          setPollStatus('approved');
          setApprovedData({ accessToken: data.accessToken, user: data.user });
          clearInterval(pollRef.current);
        } else {
          setPollStatus('denied');
          clearInterval(pollRef.current);
        }
      } catch {
        // 네트워크 일시 오류 무시 - 다음 폴링에서 재시도
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [challengeId]);

  const resend = async () => {
    const data = await twoFactorApi.resend(challengeId);
    setChallengeId(data.challengeId);
    setOptions(data.options);
    setRemainingSeconds(60);
    setPollStatus('polling');
  };

  return { options, remainingSeconds, pollStatus, approvedData, resend };
}

export { useTwoFactorPolling };
export type { ApprovedData };

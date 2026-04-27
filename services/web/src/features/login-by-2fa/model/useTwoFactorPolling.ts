import { useEffect, useRef, useState } from 'react';
import { twoFactorApi, type ChallengeStatus } from '../api/twoFactorApi';

const POLL_INTERVAL_MS = 3000; // 3초마다

type PollStatus = 'polling' | 'approved' | 'denied';

export interface ApprovedData {
  accessToken: string;
  user: { id: string; username: string; nickname: string };
}

export function useTwoFactorPolling(initialChallengeId: string) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [options, setOptions] = useState<string[]>([]);
  const [correctNum, setCorrectNum] = useState<string>('');
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
          setCorrectNum(data.correctNum);
          setRemainingSeconds(data.remainingSeconds);
        } else if (data.status === 'APPROVED') {
          clearInterval(pollRef.current);
          try {
            const completed = await twoFactorApi.complete(challengeId);
            setApprovedData({ accessToken: completed.accessToken, user: completed.user });
            setPollStatus('approved');
          } catch {
            setPollStatus('denied');
          }
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

  return { options, correctNum, remainingSeconds, pollStatus, approvedData, resend };
}

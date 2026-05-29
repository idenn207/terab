import { useUserStore } from '@/entities';
import { logger } from '@/shared/lib';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompleteTwoFaMutation, useResendChallengeMutation } from '../api/mutation';
import type { ChallengeStatusPendingDto } from '@shared/api';
import { useChallengeStatusQuery } from '../api/query';

export function useTwoFactorPolling(initialChallengeId: string) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [pollEnabled, setPollEnabled] = useState(true);
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const resendMutation = useResendChallengeMutation();
  const completeMutation = useCompleteTwoFaMutation();

  // setAuth 가 store 를 변경하면 hook 이 재실행되고 effect deps 변화로 APPROVED 분기가 다시
  // 진입할 수 있다. 같은 challengeId 로 complete 가 중복 호출되는 것을 막기 위한 1회성 가드.
  const completedRef = useRef(false);

  const { data, isError } = useChallengeStatusQuery(challengeId, pollEnabled);

  useEffect(() => {
    if (isError) {
      // 폴링 자체가 5xx/network 등으로 죽으면 사용자는 영원히 "승인 대기" 상태에 갇힌다.
      // setState in effect: 폴링 종료를 위한 1회성 전환
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPollEnabled(false);
      logger.error({ challengeId }, '2FA polling failed');
      navigate('/login?error=2fa_polling_error');
      return;
    }

    if (!data) return;

    if (data.status === 'DENIED' || data.status === 'EXPIRED') {
      // setState in effect: 폴링 종료를 위한 1회성 전환 — services/web 미러
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPollEnabled(false);
      navigate('/login?error=2fa_denied');
      return;
    }

    if (data.status === 'APPROVED') {
      if (completedRef.current) return;
      completedRef.current = true;
      // setState in effect: 폴링 종료를 위한 1회성 전환 — services/web 미러
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPollEnabled(false);
      completeMutation
        .mutateAsync({ path: { id: challengeId } })
        .then((completeRes) => {
          if (completeRes.status === 'AUTHENTICATED') {
            setAuth(completeRes.accessToken, completeRes.user);
            navigate('/admin');
            return;
          }
          // 타입상 2FA_REQUIRED 분기 — completeTwoFa는 서버가 항상 AUTHENTICATED만 반환하지만
          // LoginResponse union 타입을 방어적으로 좁혀 실패로 처리.
          navigate('/login?error=2fa_failed');
        })
        .catch((err: unknown) => {
          logger.error({ err, challengeId }, 'completeTwoFa failed');
          navigate('/login?error=2fa_failed');
        });
    }
  }, [data, isError, completeMutation, navigate, challengeId, setAuth]);

  // 응답 union 이 intersection 형태(`{status:'PENDING'} & ChallengeStatusPendingDto`) 라
  // discriminator narrowing 이 const 할당을 통해 전파되지 않음 — codegen 타입을 직접 인용한다.
  const pendingData = data?.status === 'PENDING' ? (data as ChallengeStatusPendingDto) : null;

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

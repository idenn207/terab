import { useCallback, useRef, useState } from 'react';
import type { IssuedMountCredential } from '@/entities';
import { useIssueMountCredentialMutation } from '../api/mutation';

export function useIssueMountCredential() {
  const [issued, setIssued] = useState<IssuedMountCredential | null>(null);
  const mutation = useIssueMountCredentialMutation();
  const { mutateAsync, reset } = mutation;
  const inFlightRef = useRef(false);

  // 발급 응답은 password/script 를 품고 있어 mutation state 에 남으면 UI 수명보다 오래 잔존한다 —
  // state 를 비울 때 mutation cache 도 함께 reset
  const clearIssued = useCallback(() => {
    setIssued(null);
    reset();
  }, [reset]);

  const issue = useCallback(
    async (driveId?: string) => {
      // 중복 발급 시 먼저 받은 1회용 password 가 덮어써져 영구 유실된다
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      try {
        const data = await mutateAsync({ body: driveId ? { driveId } : {} });
        setIssued(data);
        return data;
      } finally {
        inFlightRef.current = false;
      }
    },
    [mutateAsync],
  );

  return {
    issue,
    issued,
    clearIssued,
    isIssuing: mutation.isPending,
    error: mutation.error,
  };
}

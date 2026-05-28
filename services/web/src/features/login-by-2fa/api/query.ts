import { challengeControllerGetStatusOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useChallengeStatusQuery(challengeId: string, enabled: boolean) {
  return useQuery({
    ...challengeControllerGetStatusOptions({ path: { id: challengeId } }),
    enabled: enabled && !!challengeId,
    refetchInterval: 3000,
    retry: false,
  });
}

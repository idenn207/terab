import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useChallengeStatusQuery(challengeId: string, enabled: boolean) {
  return api.twofa.getStatus.useQuery({
    queryKey: [contract.twofa.getStatus, challengeId],
    queryData: { params: { id: challengeId } },
    enabled: enabled && !!challengeId,
    refetchInterval: 3000,
    retry: false,
  });
}

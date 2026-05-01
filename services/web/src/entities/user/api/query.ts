import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useMeQuery() {
  return api.auth.me.useQuery({
    queryKey: [contract.auth.me.path],
    staleTime: 1000 * 60 * 5,
  });
}

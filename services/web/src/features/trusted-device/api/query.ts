import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useTrustedDevicesQuery() {
  return api.trustedDevice.list.useQuery({
    queryKey: [contract.trustedDevice.list],
    staleTime: 1000 * 60,
  });
}

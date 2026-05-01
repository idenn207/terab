import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useValidateInvitationQuery(token: string) {
  return api.invitation.validate.useQuery({
    queryKey: [contract.invitation.validate.path, token],
    queryData: { params: { token } },
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 30,
  });
}

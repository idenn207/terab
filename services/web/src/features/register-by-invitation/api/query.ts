import { useQuery } from '@tanstack/react-query';
import { invitationControllerValidateOptions } from '@shared/api';

export function useValidateInvitationQuery(token: string) {
  return useQuery({
    ...invitationControllerValidateOptions({ path: { token } }),
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 30,
  });
}

import { api } from '@/shared/api';

export function useLogoutMutation() {
  return api.auth.logout.useMutation();
}

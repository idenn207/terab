import { api } from '@/shared/api';

export function useLoginMutation() {
  return api.auth.login.useMutation();
}

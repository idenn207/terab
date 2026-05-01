import { api } from '@/shared/api';

export function useRegisterMutation() {
  return api.auth.register.useMutation();
}

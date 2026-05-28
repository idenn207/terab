import { loginControllerRegisterMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useRegisterMutation() {
  return useMutation({ ...loginControllerRegisterMutation() });
}

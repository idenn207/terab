import { loginControllerLogoutMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLogoutMutation() {
  return useMutation({ ...loginControllerLogoutMutation() });
}

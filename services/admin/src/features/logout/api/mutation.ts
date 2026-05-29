import { authControllerLogoutMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLogoutMutation() {
  return useMutation({ ...authControllerLogoutMutation() });
}

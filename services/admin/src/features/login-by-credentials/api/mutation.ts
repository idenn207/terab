import { authControllerLoginMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLoginMutation() {
  return useMutation({ ...authControllerLoginMutation() });
}

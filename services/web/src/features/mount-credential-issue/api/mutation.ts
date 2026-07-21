import { mountCredentialControllerIssueMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useIssueMountCredentialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mountCredentialControllerIssueMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'mountCredentialControllerList' }] });
    },
  });
}

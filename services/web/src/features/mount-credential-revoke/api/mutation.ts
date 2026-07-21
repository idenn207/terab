import { mountCredentialControllerRevokeMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRevokeMountCredentialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mountCredentialControllerRevokeMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'mountCredentialControllerList' }] });
    },
  });
}

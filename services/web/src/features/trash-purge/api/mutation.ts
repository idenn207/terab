import { trashControllerPermanentDeleteMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useTrashPermanentDeleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trashControllerPermanentDeleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'trashControllerList' }] });
    },
  });
}

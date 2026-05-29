import { trashControllerRestoreMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useTrashRestoreMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trashControllerRestoreMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'trashControllerList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetRoot' }], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }], refetchType: 'all' });
    },
  });
}

import { folderControllerRemoveMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFolderRemoveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...folderControllerRemoveMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetRoot' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] });
    },
  });
}

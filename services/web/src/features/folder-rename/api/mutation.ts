import { folderControllerRenameMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFolderRenameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...folderControllerRenameMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetRoot' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] });
    },
  });
}

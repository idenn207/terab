import { folderControllerCreateMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFolderCreateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...folderControllerCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetRoot' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] });
    },
  });
}

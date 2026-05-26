import { fileUploadControllerCompleteMutation, fileUploadControllerInitMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUploadInitMutation() {
  return useMutation({ ...fileUploadControllerInitMutation() });
}

export function useUploadCompleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...fileUploadControllerCompleteMutation(),
    onSuccess: () => {
      // partial match — folderId 무관하게 자식 목록을 한 번에 새 파일 반영
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] });
    },
  });
}

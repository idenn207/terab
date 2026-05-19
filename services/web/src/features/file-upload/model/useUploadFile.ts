import { useMutation } from '@tanstack/react-query';
import { useUploadCompleteMutation, useUploadInitMutation } from '../api/mutation';
import { uploadParts } from './upload-parts';

export interface UploadFileInput {
  file: File;
  folderId?: string;
}

export function useUploadFile() {
  const initMutation = useUploadInitMutation();
  const completeMutation = useUploadCompleteMutation();

  return useMutation({
    mutationFn: async ({ file, folderId }: UploadFileInput) => {
      const init = await initMutation.mutateAsync({
        body: {
          folderId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      });

      const partResults = await uploadParts(file, init.parts, init.uploadHeaders);

      return completeMutation.mutateAsync({
        path: { sessionId: init.sessionId },
        body: { parts: partResults },
      });
    },
  });
}

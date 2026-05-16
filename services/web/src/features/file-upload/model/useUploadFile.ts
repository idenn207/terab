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
      const initRes = await initMutation.mutateAsync({
        body: {
          folderId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      });
      if (initRes.status !== 201) {
        throw new Error(`upload-init failed: ${initRes.status}`);
      }
      const init = initRes.body;

      const partResults = await uploadParts(file, init.parts, init.uploadHeaders);

      const completeRes = await completeMutation.mutateAsync({
        params: { sessionId: init.sessionId },
        body: { parts: partResults },
      });
      if (completeRes.status !== 201) {
        throw new Error(`upload-complete failed: ${completeRes.status}`);
      }
      return completeRes.body;
    },
  });
}

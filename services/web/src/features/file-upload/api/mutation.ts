import { api } from '@/shared/api';

export function useUploadInitMutation() {
  return api.file.uploadInit.useMutation();
}

export function useUploadCompleteMutation() {
  return api.file.uploadComplete.useMutation();
}

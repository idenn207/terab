import { fileUploadControllerCompleteMutation, fileUploadControllerInitMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useUploadInitMutation() {
  return useMutation({ ...fileUploadControllerInitMutation() });
}

export function useUploadCompleteMutation() {
  return useMutation({ ...fileUploadControllerCompleteMutation() });
}

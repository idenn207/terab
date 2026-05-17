import { useMutation } from '@tanstack/react-query';
import { deviceControllerRegisterMutation } from '@shared/api';

export function useRegisterDeviceMutation() {
  return useMutation({ ...deviceControllerRegisterMutation() });
}

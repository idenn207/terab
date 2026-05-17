import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  trustedDeviceControllerListQueryKey,
  trustedDeviceControllerRegisterMutation,
  trustedDeviceControllerRevokeMutation,
} from '@shared/api';

export function useRegisterTrustedDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trustedDeviceControllerRegisterMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trustedDeviceControllerListQueryKey() });
    },
  });
}

export function useRevokeTrustedDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trustedDeviceControllerRevokeMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trustedDeviceControllerListQueryKey() });
    },
  });
}

import { api } from '@/shared/api';

export function useRegisterDeviceMutation() {
  return api.device.register.useMutation();
}

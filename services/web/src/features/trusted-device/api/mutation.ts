import { api } from '@/shared/api';

export function useRegisterTrustedDeviceMutation() {
  return api.trustedDevice.register.useMutation();
}

export function useRevokeTrustedDeviceMutation() {
  return api.trustedDevice.revoke.useMutation();
}

import { trustedDeviceApi } from '../api/trustedDeviceApi';

export function useTrustedDevice() {
  const register = () => trustedDeviceApi.register();
  const revoke = (id: string) => trustedDeviceApi.revoke(id);
  return { register, revoke };
}

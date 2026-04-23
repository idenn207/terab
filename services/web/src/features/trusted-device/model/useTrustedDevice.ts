import { useEffect, useState } from 'react';
import { trustedDeviceApi, type TrustedDeviceItem } from '../api/trustedDeviceApi';

export function useTrustedDevice() {
  const [devices, setDevices] = useState<TrustedDeviceItem[]>([]);

  useEffect(() => {
    trustedDeviceApi.list().then(setDevices);
  }, []);

  const register = async () => await trustedDeviceApi.register();

  const revoke = async (id: string) => {
    await trustedDeviceApi.revoke(id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return { devices, register, revoke };
}

import { useTrustedDevicesQuery } from '../api/query';
import type { TrustedDevice } from './types';

export interface UseTrustedDeviceListResult {
  devices: TrustedDevice[];
  isLoading: boolean;
  error: Error | null;
}

export function useTrustedDeviceList(): UseTrustedDeviceListResult {
  const query = useTrustedDevicesQuery();
  return {
    devices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

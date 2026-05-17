import { useQuery } from '@tanstack/react-query';
import { trustedDeviceControllerListOptions } from '@shared/api';

export function useTrustedDevicesQuery() {
  return useQuery({
    ...trustedDeviceControllerListOptions(),
    staleTime: 1000 * 60,
  });
}

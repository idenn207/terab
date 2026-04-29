import { axiosAuth } from '@/shared/api';

export interface TrustedDeviceItem {
  id: string;
  userAgent: string | null;
  expiresAt: string;
}

export const trustedDeviceApi = {
  list: (): Promise<TrustedDeviceItem[]> => axiosAuth.get<TrustedDeviceItem[]>('/trusted-device').then((r) => r.data),
  register: (): Promise<void> => axiosAuth.post('/trusted-device').then(() => {}),
  revoke: (id: string): Promise<void> => axiosAuth.delete(`/trusted-device/${id}`).then(() => {}),
};

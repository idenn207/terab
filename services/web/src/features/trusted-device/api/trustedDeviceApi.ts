import { axiosUser } from '@/shared/api';

export interface TrustedDeviceItem {
  id: string;
  userAgent: string | null;
  expiresAt: string;
}

export const trustedDeviceApi = {
  list: (): Promise<TrustedDeviceItem[]> => axiosUser.get<TrustedDeviceItem[]>('/trusted-device').then((r) => r.data),
  register: (): Promise<void> => axiosUser.post('/trusted-device').then(() => {}),
  revoke: (id: string): Promise<void> => axiosUser.delete(`/trusted-device/${id}`).then(() => {}),
};

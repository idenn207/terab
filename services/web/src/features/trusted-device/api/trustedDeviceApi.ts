import { axiosUser } from '@/shared/api';

export interface TrustedDeviceItem {
  id: string;
  userAgent: string | null;
  expiresAt: string;
}

export const trustedDeviceApi = {
  list: (): Promise<TrustedDeviceItem[]> => axiosUser.get<TrustedDeviceItem[]>('/api/auth/trusted-devices').then((r) => r.data),
  register: (): Promise<TrustedDeviceItem> => axiosUser.post<TrustedDeviceItem>('/api/auth/trusted-devices').then((r) => r.data),
  revoke: (id: string): Promise<void> => axiosUser.delete(`/api/auth/trusted-devices/${id}`).then(() => {}),
};

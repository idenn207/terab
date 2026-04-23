import { axiosUser } from '@/shared/api';

interface RegisterPushTokenRequest {
  pushToken: string;
  platform: 'android' | 'ios';
  name?: string;
}

interface RegisterPushTokenResponse {
  deviceId: string;
}

const deviceApi = {
  registerPushToken: (data: RegisterPushTokenRequest) => axiosUser.post<RegisterPushTokenResponse>('/auth/devices/push-token', data).then((r) => r.data),
};

export { deviceApi };
export type { RegisterPushTokenRequest };

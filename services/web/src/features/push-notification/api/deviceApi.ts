import { axiosAuth } from '@/shared/api';

interface RegisterPushTokenRequest {
  pushToken: string;
}

interface RegisterPushTokenResponse {
  deviceId: string;
}

const deviceApi = {
  registerPushToken: (data: RegisterPushTokenRequest) => axiosAuth.post<RegisterPushTokenResponse>('/devices', data).then((r) => r.data),
};

export { deviceApi };
export type { RegisterPushTokenRequest };

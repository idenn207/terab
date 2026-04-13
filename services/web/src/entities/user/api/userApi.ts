import { axiosInstance } from '@/shared/api';
import type { User } from '../model/types';

const userApi = {
  me: () => axiosInstance.get<User>('/auth/me').then((r) => r.data),
};

export { userApi };

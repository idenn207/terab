import { axiosAuth } from '@/shared/api';
import type { User } from '../model/types';

const userApi = {
  me: () => axiosAuth.get<User>('/auth/me').then((r) => r.data),
};

export { userApi };

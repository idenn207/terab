import { axiosUser } from '@/shared/api';
import type { User } from '../model/types';

const userApi = {
  me: () => axiosUser.get<User>('/auth/me').then((r) => r.data),
};

export { userApi };

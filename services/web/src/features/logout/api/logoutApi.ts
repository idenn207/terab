import { axiosUser } from '@/shared/api';

const logoutApi = {
  logout: () => axiosUser.post('/auth/logout'),
};

export { logoutApi };

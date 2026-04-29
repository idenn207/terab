import { axiosAuth } from '@/shared/api';

const logoutApi = {
  logout: () => axiosAuth.post('/auth/logout'),
};

export { logoutApi };

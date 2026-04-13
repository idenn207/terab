import { axiosInstance } from '@/shared/api';

const logoutApi = {
  logout: () => axiosInstance.post('/auth/logout'),
};

export { logoutApi };

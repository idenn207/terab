import type { User } from '@/entities/user/model/types';
import axios from 'axios';

interface LoginApiRequest {
  username: string;
  password: string;
}

interface LoginApiResponse {
  accessToken: string;
  user: User;
}

/** @description Login은 accessToken 없이 접근하기 때문에 axios instance 없이 따로 구축 */
const loginApi = {
  login: (data: LoginApiRequest) => axios.post<LoginApiResponse>('/api/auth/login', data, { withCredentials: true }).then((r) => r.data),
};

export { loginApi };

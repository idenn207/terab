import { useUserStore } from '@/entities';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** accessToken 으로 요철 */
const axiosUser = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

axiosUser.interceptors.request.use((config) => {
  const token = useUserStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

axiosUser.interceptors.response.use(
  (response) => response,
  async (error: AxiosError | unknown) => {
    // AxiosError
    if (error instanceof AxiosError) {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosUser(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ accessToken: string; user: unknown }>('/api/auth/refresh', {}, { withCredentials: true });
        useUserStore.getState().setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosUser(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useUserStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }

      // no AxiosError
    } else {
      // nothing else...
    }
  },
);

export { axiosUser };

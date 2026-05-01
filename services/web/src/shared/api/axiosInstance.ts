import { useUserStore } from '@/entities';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** accessToken 없이 일반 요청 */
const axiosBasic = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

/** accessToken 으로 요청 + refreshToken 검증 */
const axiosAuth = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

axiosAuth.interceptors.request.use((config) => {
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

axiosAuth.interceptors.response.use(
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
          return axiosAuth(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosBasic.post<{ accessToken: string; user: unknown }>('/auth/refresh', {}, { withCredentials: true });
        useUserStore.getState().setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosAuth(originalRequest);
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

export { axiosAuth, axiosBasic };

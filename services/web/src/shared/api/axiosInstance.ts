import { useUserStore } from '@/entities';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { isPublicPath } from './generated/public-paths.gen';

export const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  if (config.url && isPublicPath(config.url)) {
    return config;
  }
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

// 레거시 consumer 호환(userApi, backupCodeApi, PrivateRoute) — backup-codes 엔드포인트가 swagger 미노출이라
// codegen 마이그레이션이 선행 작업(swagger 노출)을 필요로 함. 추후 단일 인스턴스화 follow-up에서 제거.
export const axiosAuth = axiosInstance;
export const axiosBasic = axios.create({ baseURL: '/api', withCredentials: true });

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) {
      throw error;
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      throw error;
    }

    if (originalRequest.url && isPublicPath(originalRequest.url)) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string; user: unknown }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      useUserStore.getState().setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useUserStore.getState().clearAuth();
      window.location.href = '/login';
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);

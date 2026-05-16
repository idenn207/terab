import { useUserStore } from '@/entities';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { PUBLIC_PATHS } from './generated/public-paths.gen';

export const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  if (config.url && PUBLIC_PATHS.has(config.url)) {
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

// Phase 0 호환: 기존 ts-rest consumer가 axiosAuth/axiosBasic을 import 중.
// Phase 6 (auth) 도메인 전환 완료 시 제거 — axiosInstance 단일화.
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

    if (originalRequest.url && PUBLIC_PATHS.has(originalRequest.url)) {
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

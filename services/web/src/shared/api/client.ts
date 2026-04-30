import { contract } from '@terab/contract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { axiosAuth, axiosBasic } from './axiosInstance';

// 401 -> refresh - redirect 루프를 막아야 하는 공개 엔드포인트
const PUBLIC_PATHS = new Set(['/auth/login', '/auth/login/backup']);

export const api = initTsrReactQuery(contract, {
  baseUrl: '',
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    const instance = PUBLIC_PATHS.has(path) ? axiosBasic : axiosAuth;
    const response = await instance.request({
      url: path,
      withCredentials: true,
      method,
      headers,
      data: body,
    });
    return { status: response.status, body: response.data, headers: response.headers as unknown as Headers };
  },
});

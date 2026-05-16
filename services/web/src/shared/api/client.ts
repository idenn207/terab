import { contract } from '@terab/contract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import axios from 'axios';
import { axiosInstance } from './axiosInstance';

// Phase 0: 기존 ts-rest 공개 경로는 인터셉터를 거치지 않는 별도 axios 인스턴스로 호출.
// Phase 6 (auth) 완료 시 OpenAPI 기반 PUBLIC_PATHS로 일원화되어 이 분기가 제거된다.
const legacyPublicAxios = axios.create({ baseURL: '/api', withCredentials: true });
const LEGACY_PUBLIC_PATHS = new Set(['/auth/login', '/auth/login/backup']);

export const api = initTsrReactQuery(contract, {
  baseUrl: '',
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    const instance = LEGACY_PUBLIC_PATHS.has(path) ? legacyPublicAxios : axiosInstance;
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

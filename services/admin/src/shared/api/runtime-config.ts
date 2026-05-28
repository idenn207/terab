import type { CreateClientConfig } from './generated/client.gen';
import { axiosInstance } from './axiosInstance';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  axios: axiosInstance,
});

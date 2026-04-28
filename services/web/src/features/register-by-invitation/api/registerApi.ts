import axios from 'axios';

export interface RegisterRequest {
  token: string;
  username: string;
  nickname: string;
  password: string;
}

export interface RegisterResponse {
  accessToken: string;
  user: { id: string; username: string; nickname: string };
  backupCodes: string[];
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const { data: response } = await axios.post<RegisterResponse>('/api/auth/register', data, {
    withCredentials: true,
  });
  return response;
}

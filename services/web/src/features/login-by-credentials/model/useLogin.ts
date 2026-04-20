import { useUserStore } from '@/entities';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../api/loginApi';
import type { ApiErrorCode } from './loginErrors';

export interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginError {
  code: ApiErrorCode;
  message: string;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const resetError = () => setError(null);
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await loginApi.login(credentials);
      if (data.status === 'AUTHENTICATED') {
        setAuth(data.accessToken!, data.user!);
        navigate('/drive');
      } else if (data.status === '2FA_REQUIRED') {
        navigate(`/login/2fa?id=${data.challengeId}`);
      } else {
        // ...something else
      }
    } catch (err: AxiosError | Error | unknown) {
      const response = (err as AxiosError<LoginError>)?.response;
      setError({
        code: response?.data?.code ?? 'UNKNOWN',
        message: response?.data?.message ?? '로그인에 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, resetError };
}

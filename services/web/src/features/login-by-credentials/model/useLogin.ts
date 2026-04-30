import { useUserStore } from '@/entities';
import { parseApiError } from '@/shared/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../api/loginApi';
import type { ApiErrorCode } from './loginErrors';
import { LOGIN_ERROR_MESSAGES } from './loginErrors';

export interface LoginCredentials {
  username: string;
  password: string;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<{ code: ApiErrorCode | 'UNKNOWN'; message: string } | null>(null);
  const resetError = () => setApiError(null);
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await loginApi.login(credentials);
      if (data.status === 'AUTHENTICATED') {
        setAuth(data.accessToken!, data.user!);
        navigate('/drive');
      } else if (data.status === '2FA_REQUIRED') {
        navigate(`/login/2fa?id=${data.challengeId}`);
      }
    } catch (err: unknown) {
      setApiError(parseApiError<ApiErrorCode>(err, { code: 'UNKNOWN', message: LOGIN_ERROR_MESSAGES.UNKNOWN }));
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, apiError, resetError };
}

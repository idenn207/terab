import { useUserStore } from '@/entities';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { twoFactorApi } from '../api/twoFactorApi';
import type { ApiErrorCode } from './twoFactorErrors';

export interface BackupLoginForm {
  username: string;
  password: string;
  backupCode: string;
}

interface LoginError {
  code: ApiErrorCode;
  message: string;
}

export function useBackupLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const resetError = () => setError(null);
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);

  const login = async (form: BackupLoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await twoFactorApi.backupLogin(form);
      setAuth(data.accessToken, data.user);
      navigate('/drive');
    } catch (err) {
      const { code, message } = (err as AxiosError<LoginError>)?.response?.data ?? {};
      setError({
        code: code ?? 'UNKNOWN',
        message: message ?? '로그인에 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, resetError };
}

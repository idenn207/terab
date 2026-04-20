import { useUserStore } from '@/entities';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { twoFactorApi } from '../api/twoFactorApi';

interface BackupLoginForm {
  username: string;
  password: string;
  backupCode: string;
}

function useBackupLogin() {
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetError = () => setError(null);

  const login = async (form: BackupLoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await twoFactorApi.backupLogin(form);
      setAuth(data.accessToken, data.user);
      navigate('/drive');
    } catch (err) {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      setError(msg ?? '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, resetError };
}

export { useBackupLogin };
export type { BackupLoginForm };

import { useUserStore } from '@/entities';
import { parseApiError } from '@/shared/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { twoFactorApi } from '../api/twoFactorApi';
import type { ApiErrorCode } from './twoFactorErrors';
import { TWO_FACTOR_ERROR_MESSAGES } from './twoFactorErrors';

export interface BackupLoginForm {
  username: string;
  password: string;
  backupCode: string;
}

export function useBackupLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<{ code: ApiErrorCode | 'UNKNOWN'; message: string } | null>(null);
  const resetError = () => setApiError(null);
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);

  const login = async (form: BackupLoginForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await twoFactorApi.backupLogin(form);
      setAuth(data.accessToken, data.user);
      navigate('/drive');
    } catch (err) {
      setApiError(parseApiError<ApiErrorCode>(err, { code: 'UNKNOWN', message: TWO_FACTOR_ERROR_MESSAGES.UNKNOWN }));
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, apiError, resetError };
}

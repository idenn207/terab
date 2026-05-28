import { useUserStore } from '@/entities';
import { parseApiError } from '@/shared/api';
import { useNavigate } from 'react-router-dom';
import { useLoginWithBackupMutation } from '../api/mutation';
import { TWO_FACTOR_ERROR_MESSAGES, type ApiErrorCode } from './twoFactorErrors';

export interface BackupLoginForm {
  username: string;
  password: string;
  backupCode: string;
}

export function useBackupLogin() {
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);
  const mutation = useLoginWithBackupMutation();

  const loginWithBackup = async (form: BackupLoginForm) => {
    mutation.mutate(
      { body: form },
      {
        onSuccess: (data) => {
          if (data.status === 'AUTHENTICATED') {
            setAuth(data.accessToken, data.user);
            navigate('/admin');
          }
        },
      },
    );
  };

  const apiError = mutation.isError ? parseApiError<ApiErrorCode>(mutation.error, { code: 'UNKNOWN', message: TWO_FACTOR_ERROR_MESSAGES.UNKNOWN }) : null;

  return { loginWithBackup, isLoading: mutation.isPending, apiError };
}

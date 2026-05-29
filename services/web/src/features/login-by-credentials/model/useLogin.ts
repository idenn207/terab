import { useUserStore } from '@/entities';
import { parseApiError } from '@/shared/api';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../api/mutation';
import type { ApiErrorCode } from './loginErrors';
import { LOGIN_ERROR_MESSAGES } from './loginErrors';

export interface LoginCredentials {
  username: string;
  password: string;
  trustDevice?: boolean;
}

export function useLogin() {
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mutation = useLoginMutation();

  const login = async (credentials: LoginCredentials) => {
    mutation.mutate(
      { body: credentials },
      {
        onSuccess: (data) => {
          if (data.status === 'AUTHENTICATED') {
            setAuth(data.accessToken, data.user);
            navigate('/drive', { replace: true });
          } else if (data.status === '2FA_REQUIRED') {
            navigate(`/login/2fa?id=${data.challengeId}`, { replace: true });
          }
        },
      },
    );
  };

  const apiError = mutation.isError ? parseApiError<ApiErrorCode>(mutation.error, { code: 'UNKNOWN', message: LOGIN_ERROR_MESSAGES.UNKNOWN }) : null;

  return {
    login,
    apiError,
    isLoading: mutation.isPending,
    resetError: mutation.reset,
  };
}

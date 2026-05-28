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
    // generated 의 LoginBodyDto 에 trustDevice 옵셔널 필드 부재 시점 — 다음 codegen 시 자동 정상화
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutation.mutate(
      { body: credentials as any },
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

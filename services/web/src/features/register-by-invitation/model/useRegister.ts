import { useUserStore } from '@/entities';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { register } from '../api/registerApi';
import type { ApiErrorCode } from './registerErrors';

export interface RegisterFormValues {
  username: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

interface RegisterError {
  code: ApiErrorCode;
  message: string;
}

export function useRegister(token: string, onSuccess: (backupCodes: string[]) => void) {
  const setAuth = useUserStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const submit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await register({
        token,
        username: values.username,
        nickname: values.nickname,
        password: values.password,
      });
      setAuth(result.accessToken, result.user);
      onSuccess(result.backupCodes);
    } catch (err: unknown) {
      const { code, message } = (err as AxiosError<RegisterError>)?.response?.data ?? {};
      setError({
        code: code ?? 'UNKNOWN',
        message: message ?? '로그인에 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}

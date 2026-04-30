import { useUserStore } from '@/entities';
import { parseApiError } from '@/shared/api';
import { useRegisterMutation } from '../api/mutation';
import type { ApiErrorCode } from './registerErrors';
import { REGISTER_ERROR_MESSAGES } from './registerErrors';

export interface RegisterFormValues {
  username: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

export function useRegister(token: string, onSuccess: (backupCodes: string[]) => void) {
  const setAuth = useUserStore((s) => s.setAuth);
  const mutation = useRegisterMutation();

  const submit = (values: RegisterFormValues) => {
    mutation.mutate(
      {
        body: {
          token,
          username: values.username,
          nickname: values.nickname,
          password: values.password,
        },
      },
      {
        onSuccess: (response) => {
          if (response.status === 201) {
            setAuth(response.body.accessToken, response.body.user);
            onSuccess(response.body.backupCodes);
          }
        },
      },
    );
  };

  const apiError = mutation.isError ? parseApiError<ApiErrorCode>(mutation.error, { code: 'UNKNOWN', message: REGISTER_ERROR_MESSAGES.UNKNOWN }) : null;

  return { submit, isLoading: mutation.isPending, apiError };
}

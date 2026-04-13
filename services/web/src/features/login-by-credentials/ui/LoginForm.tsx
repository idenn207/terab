import { LogoLabel } from '@/shared/assets';
import { Button, Field, Heading, Input, Label } from '@/shared/ui';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { LOGIN_ERROR_MESSAGES } from '../model/loginErrors';
import type { LoginCredentials } from '../model/useLogin';
import { useLogin } from '../model/useLogin';

export function LoginForm() {
  const { login, isLoading, error, resetError } = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginCredentials>();

  useEffect(() => {
    if (!error) {
      clearErrors('root');
      return;
    }
    setError('root', { message: LOGIN_ERROR_MESSAGES[error.code] });
  }, [error, setError, clearErrors]);

  const displayError = errors.username?.message ?? errors.password?.message ?? errors.root?.message;

  return (
    <form onSubmit={handleSubmit(login)} className="grid w-full max-w-sm grid-cols-1 gap-6">
      <LogoLabel className="h-6 text-zinc-950 dark:text-white forced-colors:text-[CanvasText]" />
      <Heading>로그인</Heading>
      <Field>
        <Label htmlFor="username">아이디</Label>
        <Input
          // ID
          id="username"
          type="text"
          autoComplete="username"
          {...register('username', {
            required: LOGIN_ERROR_MESSAGES.USERNAME_REQUIRED,
            onChange: resetError,
          })}
        />
      </Field>
      <Field>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          // PW
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password', {
            required: LOGIN_ERROR_MESSAGES.PASSWORD_REQUIRED,
            onChange: resetError,
          })}
        />
      </Field>
      {displayError && (
        <p role="alert" className="text-sm text-red-500">
          {displayError}
        </p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? '로그인 중...' : '로그인'}
      </Button>
    </form>
  );
}

import { Button, Field, Input, Label } from '@/shared/ui';
import { useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useBackupLogin, type BackupLoginForm } from '../model/useBackupLogin';

export function TwoFactorBackupEntry() {
  const navigate = useNavigate();
  const { login, isLoading, error, resetError } = useBackupLogin();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<BackupLoginForm>();

  useEffect(() => {
    if (!error) {
      clearErrors('root');
      return;
    }
    setError('root', { message: error });
  }, [error, setError, clearErrors]);

  const displayError = errors.root?.message;

  return (
    <form onSubmit={handleSubmit(login)} className="grid w-full max-w-sm grid-cols-1 gap-6">
      <Field>
        <Label htmlFor="username">아이디</Label>
        <Input
          // ID
          id="username"
          type="text"
          autoComplete="username"
          {...register('username', { required: '아이디를 입력해 주세요.', onChange: resetError })}
        />
      </Field>
      <Field>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          // Password
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password', { required: '비밀번호를 입력해 주세요.', onChange: resetError })}
        />
      </Field>
      <Field>
        <Label htmlFor="backupCode">백업 코드</Label>
        <Input
          // BackupCode
          id="backupCode"
          type="text"
          placeholder="예: A3K9-MZ7P"
          className="font-mono"
          {...register('backupCode', {
            required: '백업 코드를 입력해 주세요.',
            pattern: {
              value: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
              message: '형식이 올바르지 않습니다. (예: A3K9-MZ7P)',
            },
            onChange: (e: ChangeEvent<HTMLInputElement>) => {
              e.target.value = e.target.value.toUpperCase();
              resetError();
            },
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
      <button type="button" onClick={() => navigate('/login')} className="text-sm text-gray-500 underline">
        일반 로그인으로 돌아가기
      </button>
    </form>
  );
}

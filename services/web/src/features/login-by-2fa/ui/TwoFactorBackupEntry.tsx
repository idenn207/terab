import { Button, Field, FieldGroup, Fieldset, Input, Label, Text } from '@/shared/ui';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { TWO_FACTOR_ERROR_MESSAGES } from '../model/twoFactorErrors';
import { useBackupLogin, type BackupLoginForm } from '../model/useBackupLogin';

export function TwoFactorBackupEntry() {
  const navigate = useNavigate();
  const { login, isLoading, error, resetError } = useBackupLogin();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<BackupLoginForm>();

  useEffect(() => {
    if (!error) {
      clearErrors('root');
      return;
    }
    setError('root', { message: TWO_FACTOR_ERROR_MESSAGES[error.code] });
  }, [error, setError, clearErrors]);

  const formatBackupCode = (s: string) => s.toUpperCase().replace(/([A-Z0-9]{4})([A-Z0-9]{1,4})/, '$1-$2');

  const displayError = Object.values(errors)
    .map((s) => s.message)
    .find((s) => !!s);

  return (
    <form onSubmit={handleSubmit(login)} className="grid w-full max-w-sm grid-cols-1 gap-6">
      <Fieldset>
        <FieldGroup>
          <Field>
            <Label htmlFor="username">아이디</Label>
            <Input
              // ID
              id="username"
              type="text"
              autoComplete="username"
              {...register('username', { required: TWO_FACTOR_ERROR_MESSAGES.USERNAME_REQUIRED, onChange: resetError })}
            />
          </Field>
          <Field>
            <Label htmlFor="password">비밀번호</Label>
            <Input
              // Password
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password', { required: TWO_FACTOR_ERROR_MESSAGES.PASSWORD_REQUIRED, onChange: resetError })}
            />
          </Field>
          <Field>
            <Label htmlFor="backupCode">백업코드</Label>
            <Input
              // BackupCode
              id="backupCode"
              type="text"
              placeholder="예: A3K9-MZ7P"
              className="font-mono"
              transform="uppercase"
              maxLength={9}
              {...register('backupCode', {
                required: TWO_FACTOR_ERROR_MESSAGES.BACKUP_CODE_REQUIRED,
                pattern: {
                  value: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
                  message: TWO_FACTOR_ERROR_MESSAGES.BACKUP_CODE_INVALID_PATTERN,
                },
                onChange: (e) => setValue('backupCode', formatBackupCode(e.target.value)),
              })}
            />
          </Field>
        </FieldGroup>
      </Fieldset>
      {displayError && (
        <Text role="alert" className="text-sm text-red-500">
          {displayError}
        </Text>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? '로그인 중...' : '로그인'}
      </Button>
      <Button type="button" className="text-sm text-gray-500 underline" onClick={() => navigate('/login')} plain>
        일반 로그인으로 돌아가기
      </Button>
    </form>
  );
}

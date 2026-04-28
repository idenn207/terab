import { Button, Field, Input, Label } from '@shared/ui';
import { useForm } from 'react-hook-form';
import { REGISTER_ERROR_MESSAGES } from '../model/registerErrors';
import { useRegister, type RegisterFormValues } from '../model/useRegister';

interface RegisterFormProps {
  token: string;
  onSuccess: (backupCodes: string[]) => void;
}

export function RegisterForm({ token, onSuccess }: RegisterFormProps) {
  const { submit, isLoading, error } = useRegister(token, onSuccess);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormValues>();

  return (
    <form onSubmit={handleSubmit(submit)} className="grid w-full max-w-sm grid-cols-1 gap-6">
      <Field>
        <Label htmlFor="username">아이디</Label>
        <Input
          // ID
          id="username"
          type="text"
          autoComplete="username"
          {...register('username', { required: REGISTER_ERROR_MESSAGES.USERNAME_REQUIRED })}
        />
        {errors.username && (
          <p role="alert" className="text-sm text-red-500">
            {errors.username.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          // ID
          id="nickname"
          type="text"
          {...register('nickname', { required: REGISTER_ERROR_MESSAGES.NICKNAME_REQUIRED })}
        />
        {errors.nickname && (
          <p role="alert" className="text-sm text-red-500">
            {errors.nickname.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          // ID
          id="password"
          type="password"
          autoComplete="password"
          {...register('password', {
            required: REGISTER_ERROR_MESSAGES.PASSWORD_REQUIRED,
            minLength: { value: 8, message: REGISTER_ERROR_MESSAGES.PASSWORD_MIN_LENGTH },
          })}
        />
        {errors.password && (
          <p role="alert" className="text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
        <Input
          // ID
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          {...register('passwordConfirm', {
            required: REGISTER_ERROR_MESSAGES.PASSWORD_CONFIRM_REQUIRED,
            validate: (v) => v === getValues('password') || REGISTER_ERROR_MESSAGES.PASSWORD_CONFIRM_NOT_VALIDE,
          })}
        />
        {errors.passwordConfirm && (
          <p role="alert" className="text-sm text-red-500">
            {errors.passwordConfirm.message}
          </p>
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error.message}
        </p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? '가입 중...' : '가입하기'}
      </Button>
    </form>
  );
}

import { AxiosError } from 'axios';

export function parseApiError<TCode extends string>(
  error: unknown,
  fallback: { code: TCode | 'UNKNOWN'; message: string },
): { code: TCode | 'UNKNOWN'; message: string } {
  const data = (error as AxiosError<{ code?: string; message?: string }>)?.response?.data;
  return {
    code: (data?.code as TCode) ?? fallback.code,
    message: data?.message ?? fallback.message,
  };
}

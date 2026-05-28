import { AxiosError } from 'axios';

export function parseApiError<TCode extends string>(
  error: unknown,
  fallback: { code: TCode | 'UNKNOWN'; message: string },
): { code: TCode | 'UNKNOWN'; message: string } {
  if (!(error instanceof AxiosError)) return fallback;
  const data = error.response?.data as { code?: string; message?: string } | undefined;
  return {
    code: (data?.code as TCode) ?? fallback.code,
    message: data?.message ?? fallback.message,
  };
}

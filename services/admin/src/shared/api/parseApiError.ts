import { AxiosError } from 'axios';

// 백엔드가 정형화된 error envelope 을 보냈을 때만 인용. 잘못된 응답(`{ code: 123 }`, HTML 본문 등) 은 fallback.
function isErrorResponse(data: unknown): data is { code?: string; message?: string } {
  if (!data || typeof data !== 'object') return false;
  const hasInvalidCode = 'code' in data && typeof (data as { code?: unknown }).code !== 'string';
  const hasInvalidMessage = 'message' in data && typeof (data as { message?: unknown }).message !== 'string';
  return !hasInvalidCode && !hasInvalidMessage;
}

export function parseApiError<TCode extends string>(
  error: unknown,
  fallback: { code: TCode | 'UNKNOWN'; message: string },
): { code: TCode | 'UNKNOWN'; message: string } {
  if (!(error instanceof AxiosError)) return fallback;
  const data: unknown = error.response?.data;
  if (!isErrorResponse(data)) return fallback;
  return {
    code: (data.code as TCode | undefined) ?? fallback.code,
    message: data.message ?? fallback.message,
  };
}

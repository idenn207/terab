import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, test } from 'vitest';
import { parseApiError } from './parseApiError';

const FALLBACK = { code: 'UNKNOWN' as const, message: '알 수 없는 오류' };

function makeAxiosError(data: unknown, status = 400): AxiosError {
  const err = new AxiosError('forced', 'ERR_BAD_REQUEST');
  err.response = {
    data,
    status,
    statusText: 'Bad Request',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as never,
  };
  return err;
}

describe('parseApiError', () => {
  test('non-AxiosError (TypeError) → fallback', () => {
    const result = parseApiError(new TypeError('boom'), FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  test('빈 응답 (response 자체 undefined) → fallback', () => {
    const err = new AxiosError('forced', 'ERR_NETWORK');
    // err.response 는 undefined
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  test('code 가 number 인 비표준 응답 → fallback (type guard 차단)', () => {
    const err = makeAxiosError({ code: 123, message: 'whoops' });
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  test('message 가 number 인 비표준 응답 → fallback', () => {
    const err = makeAxiosError({ code: 'AUTH_FAIL', message: 42 });
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  test('text/html 응답 (string body) → fallback', () => {
    const err = makeAxiosError('<html><body>500 Internal Server Error</body></html>', 500);
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  test('정상 AxiosError { code, message } → 값 통과', () => {
    const err = makeAxiosError({ code: 'AUTH_FAIL', message: '아이디 또는 비밀번호가 올바르지 않습니다' });
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual({ code: 'AUTH_FAIL', message: '아이디 또는 비밀번호가 올바르지 않습니다' });
  });

  test('정상 응답 but message 만 누락 → code 통과 + message 는 fallback', () => {
    const err = makeAxiosError({ code: 'AUTH_FAIL' });
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual({ code: 'AUTH_FAIL', message: FALLBACK.message });
  });

  test('빈 객체 응답 {} → fallback (code/message 둘 다 없음)', () => {
    const err = makeAxiosError({});
    const result = parseApiError(err, FALLBACK);
    expect(result).toEqual(FALLBACK);
  });
});

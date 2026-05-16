import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { ApiException, ErrorCode, ErrorCodeKey } from '@terab/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { RequestTraceContext } from '../request-trace-context';
import { TraceFlusher } from '../trace.flusher';
import { TraceInterceptor } from './trace.interceptor';

const codeRecord = ErrorCode as unknown as Record<string, { message: string; status: HttpStatus }>;
const errorCode4xx = (Object.entries(codeRecord).find(([, d]) => d.status < 500)?.[0] ?? 'UNKNOWN') as ErrorCodeKey;

const flushOk = jest.fn();
const flushError = jest.fn();

const flusher = { flushOk, flushError } as unknown as TraceFlusher;

const buildExecutionContext = (
  options: { method?: string; path?: string; reqId?: string; userId?: string | null; statusCode?: number } = {},
): ExecutionContext => {
  const request = {
    id: options.reqId ?? 'rq-1',
    method: options.method ?? 'GET',
    url: options.path ?? '/api/x',
    route: { path: options.path ?? '/api/x' },
    user: options.userId === null ? undefined : { id: options.userId ?? 'u-1' },
  };
  const response = { statusCode: options.statusCode ?? 200 };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
};

describe('TraceInterceptor', () => {
  let interceptor: TraceInterceptor;

  beforeEach(() => {
    interceptor = new TraceInterceptor(flusher);
    jest.clearAllMocks();
  });

  it('정상 경로에서 flushOk를 호출하고 결과를 전파한다', async () => {
    const handler: CallHandler = { handle: () => of('ok') };
    const out = await firstValueFrom(interceptor.intercept(buildExecutionContext(), handler));
    expect(out).toBe('ok');
    expect(flushOk).toHaveBeenCalledTimes(1);
    expect(flushError).not.toHaveBeenCalled();
  });

  it('오류 경로에서 flushError를 호출하고 예외를 전파한다', async () => {
    const err = new ApiException(errorCode4xx);
    const handler: CallHandler = { handle: () => throwError(() => err) };
    await expect(firstValueFrom(interceptor.intercept(buildExecutionContext(), handler))).rejects.toBe(err);
    expect(flushError).toHaveBeenCalledTimes(1);
    expect(flushOk).not.toHaveBeenCalled();
  });

  it('handler 안에서 RequestTraceContext.current()가 컨테이너를 반환한다', async () => {
    let observedReqId: string | null = null;
    const handler: CallHandler = {
      handle: () => {
        observedReqId = RequestTraceContext.current()?.reqId ?? null;
        return of(null);
      },
    };
    await firstValueFrom(interceptor.intercept(buildExecutionContext({ reqId: 'abc' }), handler));
    expect(observedReqId).toBe('abc');
  });

  it('user가 없으면 userId는 null이다', async () => {
    let observedUserId: string | null | undefined;
    const handler: CallHandler = {
      handle: () => {
        observedUserId = RequestTraceContext.current()?.userId;
        return of(null);
      },
    };
    await firstValueFrom(interceptor.intercept(buildExecutionContext({ userId: null }), handler));
    expect(observedUserId).toBeNull();
  });
});

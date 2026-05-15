import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiException, ErrorCode, ErrorCodeKey } from '@terab/common';
import { createPinoLoggerProvider, mockPinoLogger } from '@terab/test';
import { TraceFlusher } from './trace.flusher';
import { TraceContext } from './trace.type';

const codeRecord = ErrorCode as unknown as Record<string, { message: string; status: HttpStatus }>;
const errorCode4xx: ErrorCodeKey = (Object.entries(codeRecord).find(([, def]) => def.status < 500)?.[0] ??
  'UNKNOWN') as ErrorCodeKey;
const errorCode5xx: ErrorCodeKey = Object.entries(codeRecord).find(([, def]) => def.status >= 500)?.[0] as ErrorCodeKey;

describe('TraceFlusher', () => {
  let flusher: TraceFlusher;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TraceFlusher, createPinoLoggerProvider(TraceFlusher.name)],
    }).compile();
    flusher = module.get(TraceFlusher);
    jest.clearAllMocks();
  });

  const buildCtx = (): TraceContext => ({
    reqId: 'r1',
    userId: 'u1',
    route: 'GET /x',
    spans: [],
    startedAt: Date.now() - 50,
    droppedSpans: 0,
  });

  describe('flushOk', () => {
    it('meta 한 줄만 info로 flush한다', () => {
      flusher.flushOk(buildCtx(), 200);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).not.toHaveBeenCalled();
      expect(mockPinoLogger.error).not.toHaveBeenCalled();
      const payload = mockPinoLogger.info.mock.calls[0][0];
      expect(payload).toMatchObject({
        event: 'trace.meta',
        outcome: 'ok',
        status: 200,
        hasDetail: false,
      });
    });
  });

  describe('flushError', () => {
    it('ApiException 4xx면 meta(info) + detail(debug)을 emit한다', () => {
      const err = new ApiException(errorCode4xx);
      flusher.flushError(buildCtx(), err);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).not.toHaveBeenCalled();
      expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
        event: 'trace.meta',
        outcome: 'api_exception',
        hasDetail: false,
      });
      expect(mockPinoLogger.debug.mock.calls[0][0]).toMatchObject({
        event: 'trace.detail',
      });
    });

    it('ApiException 5xx면 meta(info) + detail(error)을 emit한다', () => {
      if (!errorCode5xx) {
        return;
      }
      const err = new ApiException(errorCode5xx);
      flusher.flushError(buildCtx(), err);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).not.toHaveBeenCalled();
      expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
        outcome: 'api_exception',
        hasDetail: true,
      });
      expect(mockPinoLogger.error.mock.calls[0][0]).toMatchObject({
        event: 'trace.detail',
      });
    });

    it('알 수 없는 예외면 outcome=unhandled로 meta(info) + detail(error)을 emit한다', () => {
      flusher.flushError(buildCtx(), new Error('boom'));
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).not.toHaveBeenCalled();
      expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
        outcome: 'unhandled',
        status: 500,
        hasDetail: true,
      });
    });

    it('detail 직렬화가 256KB를 초과하면 spans를 잘라낸다', () => {
      if (!errorCode5xx) return;
      const ctx = buildCtx();
      for (let i = 0; i < 200; i++) {
        ctx.spans.push({
          kind: 'service',
          class: 'X',
          method: 'm',
          startedAt: i,
          durationMs: 0,
          replay: true,
          args: { blob: 'y'.repeat(2000) },
          result: null,
          error: null,
        });
      }
      flusher.flushError(ctx, new ApiException(errorCode5xx));
      const detail = mockPinoLogger.error.mock.calls[0][0] as {
        spans: unknown[];
        truncated?: boolean;
      };
      expect(detail.truncated).toBe(true);
      expect(detail.spans.length).toBeLessThan(200);
    });
  });
});

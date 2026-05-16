import { mockPinoLogger } from '@terab/test';
import { PinoLogger } from 'nestjs-pino';
import { DrizzleQueryLogger } from './drizzle-query-logger';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

describe('DrizzleQueryLogger', () => {
  let logger: DrizzleQueryLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new DrizzleQueryLogger(new PiiMasker(), mockPinoLogger as unknown as PinoLogger);
  });

  it('컨테이너 밖에서 호출하면 예외 없이 무시한다', () => {
    expect(() => logger.logQuery('select 1', [])).not.toThrow();
  });

  describe('debug 로그', () => {
    it('params가 비어있으면 query만 msg로 debug를 호출한다', () => {
      logger.logQuery('select 1', []);
      expect(mockPinoLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).toHaveBeenCalledWith('select 1');
    });

    it('params가 있으면 마스킹된 params와 함께 debug를 호출한다', () => {
      logger.logQuery('select $1', ['v']);
      expect(mockPinoLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.debug).toHaveBeenCalledWith({ params: ['v'] }, 'select $1');
    });

    it('request context가 없어도 debug 로그는 emit된다', () => {
      logger.logQuery('select 1', []);
      expect(mockPinoLogger.debug).toHaveBeenCalledTimes(1);
    });
  });

  it('컨테이너 안에서 호출하면 sql span을 push한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        logger.logQuery('select $1', ['v']);
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(1);
        const span = ctx.spans[0];
        expect(span.kind).toBe('sql');
        if (span.kind === 'sql') {
          expect(span.sql).toBe('select $1');
          expect(span.params).toEqual(['v']);
          expect(span.durationMs).toBeNull();
          expect(span.rowCount).toBeNull();
        }
      },
    );
  });

  it('params 항목 크기가 1KB를 넘으면 <truncated...>로 치환한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        logger.logQuery('select $1', ['x'.repeat(TRACE_LIMITS.MAX_SQL_PARAM_SIZE_BYTES + 100)]);
        const span = RequestTraceContext.current()!.spans[0];
        if (span.kind === 'sql') {
          expect(span.params[0] as string).toMatch(/^<truncated:size=\d+>$/);
        }
      },
    );
  });

  it('MAX_SPANS 초과 시 push하지 않고 droppedSpans만 증가시킨다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        for (let i = 0; i < TRACE_LIMITS.MAX_SPANS + 3; i++) {
          logger.logQuery('select 1', []);
        }
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(TRACE_LIMITS.MAX_SPANS);
        expect(ctx.droppedSpans).toBe(3);
      },
    );
  });
});

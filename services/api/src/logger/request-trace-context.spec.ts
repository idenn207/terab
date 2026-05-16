import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

describe('RequestTraceContext', () => {
  it('run() 밖에서는 current()가 null을 반환한다', () => {
    expect(RequestTraceContext.current()).toBeNull();
  });

  it('run() 안에서는 current()가 컨테이너를 반환한다', async () => {
    let observed: ReturnType<typeof RequestTraceContext.current> = null;
    await RequestTraceContext.run(
      { reqId: 'r1', userId: 'u1', route: 'GET /x', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        observed = RequestTraceContext.current();
      },
    );
    expect(observed).not.toBeNull();
    expect(observed!.reqId).toBe('r1');
  });

  it('컨테이너는 비동기 경계를 가로질러 유지된다', async () => {
    let observedAfterAwait: string | null = null;
    await RequestTraceContext.run(
      { reqId: 'r2', userId: null, route: 'GET /y', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        await Promise.resolve();
        observedAfterAwait = RequestTraceContext.current()?.reqId ?? null;
      },
    );
    expect(observedAfterAwait).toBe('r2');
  });

  it('pushServiceSpan은 컨테이너에 service span을 추가한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r3', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        RequestTraceContext.pushServiceSpan({
          kind: 'service',
          class: 'X',
          method: 'm',
          startedAt: 1,
          durationMs: 2,
          replay: false,
          args: null,
          result: null,
          error: null,
        });
        expect(RequestTraceContext.current()!.spans).toHaveLength(1);
      },
    );
  });

  it('span 수가 MAX_SPANS에 도달하면 이후 push는 droppedSpans만 증가시킨다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r4', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        for (let i = 0; i < TRACE_LIMITS.MAX_SPANS + 5; i++) {
          RequestTraceContext.pushServiceSpan({
            kind: 'service',
            class: 'X',
            method: 'm',
            startedAt: i,
            durationMs: 0,
            replay: false,
            args: null,
            result: null,
            error: null,
          });
        }
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(TRACE_LIMITS.MAX_SPANS);
        expect(ctx.droppedSpans).toBe(5);
      },
    );
  });

  it('컨테이너 밖에서 push 호출하면 무시한다', () => {
    expect(() =>
      RequestTraceContext.pushServiceSpan({
        kind: 'service',
        class: 'X',
        method: 'm',
        startedAt: 0,
        durationMs: 0,
        replay: false,
        args: null,
        result: null,
        error: null,
      }),
    ).not.toThrow();
  });
});

import { AsyncLocalStorage } from 'node:async_hooks';
import { TRACE_LIMITS } from './trace.limits';
import { ServiceSpan, Span, SqlSpan, TraceContext } from './trace.type';

export class RequestTraceContext {
  private static readonly als = new AsyncLocalStorage<TraceContext>();

  static run<T>(ctx: TraceContext, fn: () => Promise<T>): Promise<T> {
    return RequestTraceContext.als.run(ctx, fn);
  }

  static current(): TraceContext | null {
    return RequestTraceContext.als.getStore() ?? null;
  }

  static pushServiceSpan(span: ServiceSpan): void {
    RequestTraceContext.pushSpan(span);
  }

  static pushSqlSqan(span: SqlSpan): void {
    RequestTraceContext.pushSpan(span);
  }

  private static pushSpan(span: Span): void {
    const ctx = RequestTraceContext.als.getStore();
    if (!ctx) return;
    if (ctx.spans.length >= TRACE_LIMITS.MAX_SPANS) {
      ctx.droppedSpans++;
      return;
    }
    ctx.spans.push(span);
  }
}

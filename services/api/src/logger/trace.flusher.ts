import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRACE_LIMITS } from './trace.limits';
import { Span, TraceContext, TraceDetailRecord, TraceMetaRecord, TraceOutcome } from './trace.type';

interface ErrorInfo {
  status: number;
  outcome: TraceOutcome;
  errorRecord: TraceDetailRecord['error'];
  needsDetail: boolean;
}

@Injectable()
export class TraceFlusher {
  constructor(@InjectPinoLogger(TraceFlusher.name) private readonly logger: PinoLogger) {}

  flushOk(ctx: TraceContext, status: number): void {
    const meta = this.buildMeta(ctx, status, 'ok', false);
    this.logger.info(meta);
  }

  flushError(ctx: TraceContext, err: unknown): void {
    const info = this.classifyError(err);
    const meta = this.buildMeta(ctx, info.status, info.outcome, info.needsDetail);
    this.logger.info(meta);
    if (info.needsDetail) {
      const detail = this.buildDetail(ctx, info.errorRecord);
      this.logger.error(detail);
    }
  }

  private classifyError(err: unknown): ErrorInfo {
    if (err instanceof ApiException) {
      const status = err.getStatus();
      const needsDetail = status >= Number(HttpStatus.INTERNAL_SERVER_ERROR);
      return {
        status,
        outcome: 'api_exception',
        errorRecord: {
          kind: 'ApiException',
          code: err.code,
          message: err.message,
          stack: err.stack,
        },
        needsDetail,
      };
    }

    const e = err as { message?: string; stack?: string };
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      outcome: 'unhandled',
      errorRecord: {
        kind: err && typeof err === 'object' ? err.constructor.name : typeof err,
        message: e?.message,
        stack: e?.stack,
      },
      needsDetail: true,
    };
  }

  private buildMeta(ctx: TraceContext, status: number, outcome: TraceOutcome, hasDetail: boolean): TraceMetaRecord {
    const counts = ctx.spans.reduce(
      (acc, span) => {
        if (span.kind === 'service') acc.service++;
        else acc.sql++;
        return acc;
      },
      { service: 0, sql: 0 },
    );
    const meta: TraceMetaRecord = {
      event: 'trace.meta',
      reqId: ctx.reqId,
      service: 'api',
      userId: ctx.userId,
      route: ctx.route,
      status,
      durationMs: Date.now() - ctx.startedAt,
      outcome,
      spanCounts: counts,
      hasDetail,
    };
    if (ctx.droppedSpans > 0) meta.droppedSpans = ctx.droppedSpans;
    return meta;
  }

  private buildDetail(ctx: TraceContext, error: TraceDetailRecord['error']): TraceDetailRecord {
    const detail: TraceDetailRecord = {
      event: 'trace.detail',
      reqId: ctx.reqId,
      service: 'api',
      error,
      spans: ctx.spans,
    };
    const limit = TRACE_LIMITS.MAX_DETAIL_SIZE_BYTES;
    let serialized = TraceFlusher.safeSize(detail);
    if (serialized <= limit) return detail;

    const trimmed: Span[] = ctx.spans.slice();
    while (trimmed.length > 0 && serialized > limit) {
      trimmed.shift();
      detail.spans = trimmed;
      detail.truncated = true;
      serialized = TraceFlusher.safeSize(detail);
    }
    return detail;
  }

  private static safeSize(record: object): number {
    try {
      return Buffer.byteLength(JSON.stringify(record), 'utf8');
    } catch {
      return 0;
    }
  }
}

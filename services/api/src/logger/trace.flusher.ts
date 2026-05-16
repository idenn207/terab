import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRACE_LIMITS } from './trace.limits';
import { Span, TraceContext, TraceDetailRecord, TraceMetaRecord, TraceOutcome } from './trace.type';

type DetailLevel = 'debug' | 'error';

interface ErrorInfo {
  status: number;
  outcome: TraceOutcome;
  errorRecord: TraceDetailRecord['error'];
  detailLevel: DetailLevel;
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
    // hasDetail = "보장되어 보이는 detail" — debug 라인은 prod에서 필터링되므로 false로 표기
    const hasDetail = info.detailLevel === 'error';
    const meta = this.buildMeta(ctx, info.status, info.outcome, hasDetail);
    this.logger.info(meta);
    const detail = this.buildDetail(ctx, info.errorRecord);
    if (info.detailLevel === 'error') {
      this.logger.error(detail);
    } else {
      this.logger.debug(detail);
    }
  }

  private classifyError(err: unknown): ErrorInfo {
    if (err instanceof ApiException) {
      const status = err.getStatus();
      const detailLevel: DetailLevel = status >= Number(HttpStatus.INTERNAL_SERVER_ERROR) ? 'error' : 'debug';
      return {
        status,
        outcome: 'api_exception',
        errorRecord: {
          kind: 'ApiException',
          code: err.code,
          message: err.message,
          stack: err.stack,
        },
        detailLevel,
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
      detailLevel: 'error',
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

import { Injectable } from '@nestjs/common';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

@Injectable()
export class DrizzleQueryLogger {
  constructor(private readonly masker: PiiMasker) {}

  logQuery(query: string, params: unknown[]): void {
    const ctx = RequestTraceContext.current();
    if (!ctx) return;
    const maskedParams = params.map((p) => this.masker.maskValue(p, TRACE_LIMITS.MAX_SQL_PARAM_SIZE_BYTES));
    RequestTraceContext.pushSqlSqan({
      kind: 'sql',
      sql: query,
      params: maskedParams,
      startedAt: Date.now(),
      durationMs: null,
      rowCount: null,
    });
  }
}

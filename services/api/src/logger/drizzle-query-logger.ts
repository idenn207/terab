import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

@Injectable()
export class DrizzleQueryLogger {
  constructor(
    private readonly masker: PiiMasker,
    @InjectPinoLogger(DrizzleQueryLogger.name) private readonly logger: PinoLogger,
  ) {}

  logQuery(query: string, params: unknown[]): void {
    const maskedParams = params.map((p) => this.masker.maskValue(p, TRACE_LIMITS.MAX_SQL_PARAM_SIZE_BYTES));

    // 쿼리를 msg로 전달해 pino-pretty가 escape 없이 그대로 출력하도록 한다 (dev 복사·붙여넣기용)
    if (maskedParams.length > 0) {
      this.logger.debug({ params: maskedParams }, query);
    } else {
      this.logger.debug(query);
    }

    const ctx = RequestTraceContext.current();
    if (!ctx) return;
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

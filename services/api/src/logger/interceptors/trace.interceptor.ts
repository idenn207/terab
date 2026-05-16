import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { RequestTraceContext } from '../request-trace-context';
import { TraceFlusher } from '../trace.flusher';
import { TraceContext } from '../trace.type';

interface AuthenticatedRequest extends Request {
  // id?: string; // pino-http에서 ReqId 선언 되어있음
  user?: { id?: string };
}

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly flusher: TraceFlusher) {}

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    const traceContext: TraceContext = {
      reqId: typeof request.id === 'string' ? request.id : 'unknown',
      userId: request.user?.id ?? null,
      route: this.formatRoute(request),
      spans: [],
      startedAt: Date.now(),
      droppedSpans: 0,
    };

    return new Observable<unknown>((subscriber) => {
      const flusher = this.flusher;
      void RequestTraceContext.run(traceContext, () => {
        return new Promise<void>((resolve) => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => {
              flusher.flushError(traceContext, err);
              subscriber.error(err);
              resolve();
            },
            complete: () => {
              flusher.flushOk(traceContext, response.statusCode);
              subscriber.complete();
              resolve();
            },
          });
        });
      });
    });
  }

  private formatRoute(request: AuthenticatedRequest): string {
    const method = request.method ?? 'UNKNOWN';
    const path = (request.route as { path?: string } | undefined)?.path ?? request.url ?? '';
    return `${method} ${path}`;
  }
}

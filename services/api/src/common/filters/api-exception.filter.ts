import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ApiException, HttpStatusMessage } from '@terab/common';
import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────
// 결정: pino 로거를 의도적으로 주입하지 않는다.
//
// 요청 단위 오류 로깅은 TraceFlusher.flushError가 권위적으로 담당한다.
// TraceInterceptor의 RxJS error path가 filter보다 먼저 호출되며,
// 4xx ApiException은 trace.meta info로, 5xx와 unhandled는 trace.detail error로
// stack과 모든 span을 포함해 기록한다.
//
// filter에 별도 로깅을 추가하면 동일 예외가 두 record로 분리 기록되어
// reqId로 손수 묶어야 하는 분석 부담이 생긴다. filter는 응답 직렬화만 담당한다.
//
// (과거 4e62b7c에서 logger를 추가했다가 이 중복 문제로 롤백된 이력 있음.)
// 자세한 근거: docs/archive/superpowers/specs/2026-05-14-api-core-and-logging-consistency-design.md §5
// ─────────────────────────────────────────────────────────────────
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor() {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // const request = ctx.getRequest<Request>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // 내부 메시지 노출 방지 — status code 기반 제네릭 메시지만 응답, 상세 오류는 로그에만 기록
      response.status(status).json({
        code: 'HTTP_ERROR',
        message: HttpStatusMessage[status] ?? 'HTTP Error',
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
    });
  }
}

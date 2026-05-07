import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ApiException, HttpStatusMessage } from '@terab/common';
import { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(ApiExceptionFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
      this.logger.warn({ url: request.url, status }, exception.message);
      response.status(status).json({
        code: 'HTTP_ERROR',
        message: HttpStatusMessage[status] ?? 'HTTP Error',
      });
      return;
    }

    this.logger.error({ err: exception, url: request.url }, '예상치 못한 오류');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
    });
  }
}

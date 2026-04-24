import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from '../exceptions/api.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        errorCode: exception.errorCode,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        errorCode: 'HTTP_ERROR',
        message: exception.message,
      });
      return;
    }

    this.logger.error('예상치 못한 오류', exception instanceof Error ? exception.stack : String(exception), { url: request.url });
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
    });
  }
}

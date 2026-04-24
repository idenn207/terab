import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodeKey } from './error-code.enum.js';

export class ApiException extends HttpException {
  readonly errorCode: ErrorCodeKey;

  constructor(code: ErrorCodeKey) {
    const { message, status } = ErrorCode[code];
    super(message, status);
    this.errorCode = code;
  }
}

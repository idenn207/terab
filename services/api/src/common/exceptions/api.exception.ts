import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodeKey } from './error-code.enum';

export class ApiException extends HttpException {
  readonly code: ErrorCodeKey;

  constructor(code: ErrorCodeKey) {
    const { message, status } = ErrorCode[code];
    super(message, status);
    this.code = code;
  }
}

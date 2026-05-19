import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorCode, type ErrorCodeKey } from '../exceptions/error-code.enum';
import { ErrorResponseDto } from '../dto/error-response.dto';

export function ApiError(...keys: ErrorCodeKey[]): MethodDecorator {
  const grouped = new Map<number, ErrorCodeKey[]>();
  for (const key of keys) {
    const status = ErrorCode[key].status;
    grouped.set(status, [...(grouped.get(status) ?? []), key]);
  }

  const responses = Array.from(grouped.entries()).map(([status, ks]) =>
    ApiResponse({
      status,
      type: ErrorResponseDto,
      description: ks.map((k) => `\`${k}\` — ${ErrorCode[k].message}`).join('\n'),
    }),
  );

  return applyDecorators(...responses);
}

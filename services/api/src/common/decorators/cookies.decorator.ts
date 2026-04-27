import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const Cookies = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): string | Record<string, string> => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return data ? (request.cookies?.[data] as string) : request.cookies;
  },
);

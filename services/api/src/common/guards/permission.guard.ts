import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../auth/types/auth-user.type.js';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user }: { user: AuthUser } = context.switchToHttp().getRequest();
    const hasAll = required.every((p) => user?.permissions?.includes(p));
    if (!hasAll) throw new ForbiddenException('접근 권한이 없습니다.');
    return true;
  }
}

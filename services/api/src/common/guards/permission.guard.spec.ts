import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard.js';
import { AuthUser } from '../../auth/types/auth-user.type.js';

function mockContext(user: AuthUser | undefined, handler: object = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  it('@RequirePermission()이 없으면 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: [] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('사용자가 필요한 권한을 보유하면 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['file:read']);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: ['file:read', 'file:write'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('사용자가 권한이 없으면 ForbiddenException을 던진다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:config']);
    const ctx = mockContext({ userId: '1', username: 'u', permissions: ['file:read'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

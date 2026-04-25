import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockGetHandler = jest.fn();
const mockGetClass = jest.fn();
const mockContext: Partial<ExecutionContext> = {
  getHandler: mockGetHandler,
  getClass: mockGetClass,
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('@Public() 라우트는 인증 없이 통과한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = guard.canActivate(mockContext as ExecutionContext);
    expect(result).toBe(true);
  });

  it('@Public()이 없는 라우트는 Passport 검증을 위임한다', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    guard.canActivate(mockContext as ExecutionContext);
    expect(superCanActivate).toHaveBeenCalled();
  });
});

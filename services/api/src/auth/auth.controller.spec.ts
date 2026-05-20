import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser, mockUser } from '@terab/test';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const authenticatedResult = {
    response: {
      status: 'AUTHENTICATED' as const,
      accessToken: 'at.token',
      user: { id: mockUser.id, username: mockUser.username, nickname: mockUser.nickname },
    },
    rawRefreshToken: 'raw.rt',
    refreshTokenExpMs: 604800000,
  };

  const twoFaRequiredResult = {
    response: {
      status: '2FA_REQUIRED' as const,
      challengeId: 'challenge-id',
      options: ['47', '82', '13'],
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            loginWithBackupCode: jest.fn(),
            completeTwoFa: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            getCurrentUser: jest.fn(),
            regenerateBackupCodes: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const body = {
      token: '00000000-0000-0000-0000-000000000000',
      username: 'user1',
      nickname: 'User One',
      password: 'password123',
    };

    it('INVITATION_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.register.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.register(body, mockRes)).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
    });

    it('INVITATION_EXPIRED가 발생하면 그대로 전파한다', async () => {
      service.register.mockRejectedValue(new ApiException('INVITATION_EXPIRED'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.register(body, mockRes)).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    });

    it('USERNAME_TAKEN이 발생하면 그대로 전파한다', async () => {
      service.register.mockRejectedValue(new ApiException('USERNAME_TAKEN'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.register(body, mockRes)).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
    });

    it('성공 시 RT 쿠키를 설정하고 RegisterResponse를 반환한다', async () => {
      service.register.mockResolvedValue({
        accessToken: 'at.token',
        user: { id: mockUser.id, username: mockUser.username, nickname: mockUser.nickname },
        backupCodes: ['CODE-0001', 'CODE-0002'],
        rawRefreshToken: 'raw.rt',
        refreshTokenExpMs: 604800000,
      });
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.register(body, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'raw.rt',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', maxAge: 604800000, path: '/' }),
      );
      expect(result).toEqual({
        accessToken: 'at.token',
        user: { id: mockUser.id, username: mockUser.username, nickname: mockUser.nickname },
        backupCodes: ['CODE-0001', 'CODE-0002'],
      });
    });
  });

  describe('login', () => {
    const body = { username: 'user1', password: 'password' };

    it('INVALID_CREDENTIALS가 발생하면 그대로 전파한다', async () => {
      service.login.mockRejectedValue(new ApiException('INVALID_CREDENTIALS'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.login(body, undefined, undefined, mockRes)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('ACCOUNT_DISABLED가 발생하면 그대로 전파한다', async () => {
      service.login.mockRejectedValue(new ApiException('ACCOUNT_DISABLED'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.login(body, undefined, undefined, mockRes)).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
    });

    it('AUTHENTICATED 응답 시 RT 쿠키를 설정한다', async () => {
      service.login.mockResolvedValue(authenticatedResult);
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.login(body, 'trust.token', 'ua', mockRes);

      expect(service.login).toHaveBeenCalledWith(body, 'trust.token', 'ua');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'raw.rt',
        expect.objectContaining({ maxAge: 604800000, path: '/' }),
      );
      expect(result).toEqual(authenticatedResult.response);
    });

    it('2FA_REQUIRED 응답 시 RT 쿠키를 설정하지 않는다', async () => {
      service.login.mockResolvedValue(twoFaRequiredResult);
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.login(body, undefined, undefined, mockRes);

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(result).toEqual(twoFaRequiredResult.response);
    });
  });

  describe('loginWithBackup', () => {
    const body = { username: 'user1', password: 'password', backupCode: 'CODE-0001' };

    it('BACKUP_CODE_INVALID가 발생하면 그대로 전파한다', async () => {
      service.loginWithBackupCode.mockRejectedValue(new ApiException('BACKUP_CODE_INVALID'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.loginWithBackup(body, mockRes)).rejects.toMatchObject({
        code: 'BACKUP_CODE_INVALID',
      });
    });

    it('성공 시 RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
      service.loginWithBackupCode.mockResolvedValue(authenticatedResult);
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.loginWithBackup(body, mockRes);

      expect(service.loginWithBackupCode).toHaveBeenCalledWith(body);
      expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', 'raw.rt', expect.any(Object));
      expect(result).toEqual(authenticatedResult.response);
    });
  });

  describe('completeTwoFa', () => {
    it('TWOFA_CHALLENGE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.completeTwoFa.mockRejectedValue(new ApiException('TWOFA_CHALLENGE_NOT_FOUND'));
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.completeTwoFa('ghost-id', mockRes)).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('성공 시 RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
      service.completeTwoFa.mockResolvedValue(authenticatedResult);
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.completeTwoFa('challenge-id', mockRes);

      expect(service.completeTwoFa).toHaveBeenCalledWith('challenge-id');
      expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', 'raw.rt', expect.any(Object));
      expect(result).toEqual(authenticatedResult.response);
    });
  });

  describe('refresh', () => {
    it('REFRESH_TOKEN_INVALID가 발생하면 그대로 전파한다', async () => {
      service.refresh.mockRejectedValue(new ApiException('REFRESH_TOKEN_INVALID'));
      const mockReq = { cookies: { refreshToken: 'old.rt' } } as unknown as Request;
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await expect(controller.refresh(mockReq, mockRes)).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALID',
      });
    });

    it('쿠키의 RT를 서비스에 전달하고 새 RT 쿠키를 설정한다', async () => {
      service.refresh.mockResolvedValue(authenticatedResult);
      const mockReq = { cookies: { refreshToken: 'old.rt' } } as unknown as Request;
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      const result = await controller.refresh(mockReq, mockRes);

      expect(service.refresh).toHaveBeenCalledWith('old.rt');
      expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', 'raw.rt', expect.any(Object));
      expect(result).toEqual(authenticatedResult.response);
    });
  });

  describe('logout', () => {
    it('쿠키의 RT를 서비스에 전달하고 쿠키를 삭제한다', async () => {
      service.logout.mockResolvedValue(undefined);
      const mockReq = { cookies: { refreshToken: 'rt.token' } } as unknown as Request;
      const mockRes = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await controller.logout(mockReq, mockRes);

      expect(service.logout).toHaveBeenCalledWith('rt.token');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' }),
      );
    });
  });

  describe('me', () => {
    it('현재 사용자 정보를 반환한다', async () => {
      const userInfo = { id: mockUser.id, username: mockUser.username, nickname: mockUser.nickname };
      service.getCurrentUser.mockResolvedValue(userInfo);

      const result = await controller.me(mockAuthUser);

      expect(service.getCurrentUser).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual(userInfo);
    });
  });

  describe('regenerateBackupCodes', () => {
    const body = { currentPassword: 'pw' };

    it('INVALID_CREDENTIALS가 발생하면 그대로 전파한다', async () => {
      service.regenerateBackupCodes.mockRejectedValue(new ApiException('INVALID_CREDENTIALS'));

      await expect(controller.regenerateBackupCodes(mockAuthUser, body)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('성공 시 service.regenerateBackupCodes(userId, currentPassword) 호출 + backupCodes 응답을 반환한다', async () => {
      const codes = Array.from({ length: 8 }, (_, i) => `CODE-${i.toString().padStart(4, '0')}`);
      service.regenerateBackupCodes.mockResolvedValue(codes);

      const result = await controller.regenerateBackupCodes(mockAuthUser, body);

      expect(service.regenerateBackupCodes).toHaveBeenCalledWith(mockAuthUser.userId, body.currentPassword);
      expect(result).toEqual({ backupCodes: codes });
    });
  });
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext, mockUser, setupMockDbTransactionChain } from '@terab/test';
import bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { RoleService } from './role/role.service';
import { SessionService } from './session/session.service';

const mockUserService = {
  findById: jest.fn(),
};

const mockRoleService = {
  findByName: jest.fn(),
  assignUserRole: jest.fn(),
  getPermissionsByUserId: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
  issueRefreshToken: jest.fn(),
  pepperPassword: jest.fn(),
  hashToken: jest.fn(),
  refreshExpMs: 86400000,
};

const mockSessionService = {
  issueForUser: jest.fn(),
  rotate: jest.fn(),
  revokeByRawToken: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: UserService, useValue: mockUserService },
        { provide: RoleService, useValue: mockRoleService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');
    mockTokenService.issueRefreshToken.mockReturnValue({
      rawRefreshToken: 'mock-raw-refresh-token',
      tokenHash: 'mock-token-hash',
      expiresAt: new Date(),
    });
    mockSessionService.issueForUser.mockResolvedValue({
      rawRefreshToken: 'mock-raw-refresh-token',
      refreshTokenExpMs: 86400000,
    });
    mockSessionService.rotate.mockResolvedValue({
      userId: 'rotated-user-id',
      rawRefreshToken: 'rotated-raw-refresh-token',
      refreshTokenExpMs: 86400000,
    });
    mockSessionService.revokeByRawToken.mockResolvedValue(undefined);
    mockRoleService.getPermissionsByUserId.mockResolvedValue(mockUser.permissions);
    mockRoleService.assignUserRole.mockResolvedValue(undefined);
  });

  describe('hashPassword', () => {
    it('peppered password를 bcrypt 해시로 반환한다', async () => {
      mockTokenService.pepperPassword.mockReturnValue('peppered');

      const result = await service.hashPassword('rawPw123');

      expect(mockTokenService.pepperPassword).toHaveBeenCalledWith('rawPw123');
      expect(result).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    });
  });

  describe('validateCredentials', () => {
    it('비밀번호가 일치하지 않으면 INVALID_CREDENTIALS 예외를 던진다', async () => {
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      const user = { password: await bcrypt.hash('peppered-other', 10), active: true };

      await expect(service.validateCredentials(user, 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('비활성 사용자면 ACCOUNT_DISABLED 예외를 던진다', async () => {
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      const user = { password: await bcrypt.hash('peppered', 10), active: false };

      await expect(service.validateCredentials(user, 'pw')).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
    });

    it('정상 자격증명이면 예외 없이 반환한다', async () => {
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      const user = { password: await bcrypt.hash('peppered', 10), active: true };

      await expect(service.validateCredentials(user, 'pw')).resolves.toBeUndefined();
    });
  });

  describe('assignDefaultRole', () => {
    it('USER 역할이 없으면 ROLE_NOT_FOUND 예외를 던진다', async () => {
      mockRoleService.findByName.mockResolvedValue(null);

      await expect(service.assignDefaultRole('user-1')).rejects.toMatchObject({
        code: 'ROLE_NOT_FOUND',
      });
    });

    it('USER 역할을 사용자에게 할당한다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);

      await service.assignDefaultRole('user-1');

      expect(mockRoleService.findByName).toHaveBeenCalledWith('USER');
      expect(mockRoleService.assignUserRole).toHaveBeenCalledWith('user-1', 'role-1');
    });
  });

  describe('generateAccessToken', () => {
    it('user에 대한 permissions를 조회하여 access token을 발급한다', async () => {
      const user = { id: 'u1', username: 'alice', nickname: 'A', password: 'x', active: true } as any;
      mockRoleService.getPermissionsByUserId.mockResolvedValue(['file:read']);
      mockTokenService.generateAccessToken.mockReturnValue('JWT');

      const token = await service.generateAccessToken(user);

      expect(mockRoleService.getPermissionsByUserId).toHaveBeenCalledWith('u1');
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith('u1', 'alice', ['file:read']);
      expect(token).toBe('JWT');
    });
  });

  describe('cookie helpers', () => {
    let res: { cookie: jest.Mock; clearCookie: jest.Mock };

    beforeEach(() => {
      res = { cookie: jest.fn(), clearCookie: jest.fn() };
    });

    it('setTrustCookie는 trustToken 쿠키를 설정한다', () => {
      service.setTrustCookie(res as any, 'raw-tt', 30 * 24 * 60 * 60 * 1000);

      expect(res.cookie).toHaveBeenCalledWith(
        'trustToken',
        'raw-tt',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        }),
      );
    });

    it('clearTrustCookie는 trustToken 쿠키를 제거한다', () => {
      service.clearTrustCookie(res as any);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'trustToken',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });
  });

  describe('issueTokenPair', () => {
    it('accessToken을 발급하고 refresh token을 쿠키로 설정한다', async () => {
      const user = { id: 'u1', username: 'alice', nickname: 'A', password: 'x', active: true } as any;
      const res = { cookie: jest.fn() } as any;
      mockRoleService.getPermissionsByUserId.mockResolvedValue(['file:read']);
      mockTokenService.generateAccessToken.mockReturnValue('JWT');
      mockSessionService.issueForUser.mockResolvedValue({
        rawRefreshToken: 'raw-rt',
        refreshTokenExpMs: 7 * 24 * 60 * 60 * 1000,
      });

      const result = await service.issueTokenPair(user, res);

      expect(result.accessToken).toBe('JWT');
      expect(mockSessionService.issueForUser).toHaveBeenCalledWith('u1');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'raw-rt',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('rawRt가 undefined면 REFRESH_TOKEN_INVALID 예외를 던진다', async () => {
      const res = { cookie: jest.fn() } as any;
      await expect(service.rotateRefreshToken(undefined, res)).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALID',
      });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('session 회전 후 새 RT를 쿠키로 설정하고 userId를 반환한다', async () => {
      const res = { cookie: jest.fn() } as any;
      mockSessionService.rotate.mockResolvedValue({
        userId: 'u1',
        rawRefreshToken: 'new-rt',
        refreshTokenExpMs: 7 * 24 * 60 * 60 * 1000,
      });

      const result = await service.rotateRefreshToken('old-rt', res);

      expect(result).toEqual({ userId: 'u1' });
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-rt',
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('rawRt가 undefined여도 refresh 쿠키는 clear한다', async () => {
      const res = { clearCookie: jest.fn() } as any;

      await service.revokeRefreshToken(undefined, res);

      expect(mockSessionService.revokeByRawToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    });

    it('rawRt가 있고 matched session이 있으면 session revoke + 쿠키 clear + userId 반환', async () => {
      const res = { clearCookie: jest.fn() } as any;
      mockSessionService.revokeByRawToken.mockResolvedValue({ userId: 'u1' });

      const result = await service.revokeRefreshToken('rt', res);

      expect(mockSessionService.revokeByRawToken).toHaveBeenCalledWith('rt');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
      expect(result).toEqual({ userId: 'u1' });
    });

    it('rawRt가 있어도 matched session이 없으면 userId 없이 반환 (쿠키는 여전히 clear)', async () => {
      const res = { clearCookie: jest.fn() } as any;
      mockSessionService.revokeByRawToken.mockResolvedValue({});

      const result = await service.revokeRefreshToken('rt', res);

      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
      expect(result).toEqual({ userId: undefined });
    });
  });

  describe('issueAfterTwoFa', () => {
    it('user가 없으면 TWOFA_CHALLENGE_NOT_FOUND 예외', async () => {
      mockUserService.findById.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(service.issueAfterTwoFa('ghost', res)).rejects.toMatchObject({
        code: 'TWOFA_CHALLENGE_NOT_FOUND',
      });
    });

    it('정상 흐름 — issueTokenPair → AUTHENTICATED', async () => {
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        username: 'a',
        nickname: 'A',
        password: 'h',
        active: true,
      });

      const res = { cookie: jest.fn() } as any;

      const result = await service.issueAfterTwoFa('u1', res);

      expect(result).toEqual({
        status: 'AUTHENTICATED',
        accessToken: 'mock.access.token',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
    });
  });
});

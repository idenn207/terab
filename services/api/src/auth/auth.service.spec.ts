import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/core';
import { mockConfigService, mockUser } from '@terab/test';
import bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockAuthRepository = {
  findUserWithPermissionsByUsername: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
  findActiveRefreshTokenByHash: jest.fn(),
  insertRefreshToken: jest.fn(),
  revokeRefreshTokenById: jest.fn(),
  findUnusedBackupCodes: jest.fn(),
  markBackupCodeUsed: jest.fn(),
  findUserByUsername: jest.fn(),
  findRoleByName: jest.fn(),
  insertUser: jest.fn(),
  insertUserRole: jest.fn(),
};

const mockTokenService = {
  generateAccessToken: jest.fn(),
  issueRefreshToken: jest.fn(),
  pepperPassword: jest.fn(),
  hashToken: jest.fn(),
  refreshExpMs: 86400000,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    mockAuthRepository.insertRefreshToken.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('비밀번호 불일치 시 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'user1', password: 'wrong' })).rejects.toThrow(ApiException);
    });

    it('비활성 계정은 ApiException(ACCOUNT_DISABLED)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue({ ...mockUser, active: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ username: 'user1', password: 'any' })).rejects.toThrow(ApiException);
    });

    it('존재하지 않는 사용자는 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' })).rejects.toThrow(ApiException);
    });

    it('인증 성공 시 accessToken과 rawRefreshToken을 반환하고 TokenService를 호출한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');
      mockTokenService.issueRefreshToken.mockReturnValue({
        rawRefreshToken: 'mock-raw-refresh-token',
        tokenHash: 'mock-token-hash',
        expiresAt: new Date(),
      });

      const result = await service.login({ username: 'user1', password: 'correct' });

      expect(result.response.accessToken).toBe('mock.access.token');
      expect(result.rawRefreshToken).toBe('mock-raw-refresh-token');
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.username,
        mockUser.permissions,
      );
      expect(mockTokenService.issueRefreshToken).toHaveBeenCalledTimes(1);
      expect(mockAuthRepository.insertRefreshToken).toHaveBeenCalledTimes(1);
    });
  });
});

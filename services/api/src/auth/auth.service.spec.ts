import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { ApiException } from '../common/exceptions/api.exception.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockAuthRepository = {
  findUserWithPermissionsByUsername: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
  findActiveRefreshTokens: jest.fn(),
  insertRefreshToken: jest.fn(),
  revokeRefreshTokenById: jest.fn(),
  findUnusedBackupCodes: jest.fn(),
  markBackupCodeUsed: jest.fn(),
  findUserByUsername: jest.fn(),
  findRoleByName: jest.fn(),
  insertUser: jest.fn(),
  insertUserRole: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.access.token'),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRY_MS: '900000',
      JWT_REFRESH_EXPIRY_MS: '604800000',
      PASSWORD_PEPPER: 'test-pepper',
    };
    return config[key];
  }),
  get: jest.fn().mockReturnValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('validateCredentials', () => {
    it('비밀번호 불일치 시 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      await expect(
        service.validateCredentials(
          { password: '$2a$10$wronghash', active: true } as any,
          'wrong-password',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('비활성 계정은 ApiException(ACCOUNT_DISABLED)을 던진다', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateCredentials(
          { password: 'hash', active: false } as any,
          'any-password',
        ),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('generateAccessToken', () => {
    it('JwtService.sign을 호출하고 AT를 반환한다', () => {
      const user = {
        id: 'uuid-1',
        username: 'user1',
        permissions: ['file:read'],
      };
      const token = service.generateAccessToken(user as any);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'uuid-1', username: 'user1', permissions: ['file:read'] },
        expect.objectContaining({ expiresIn: expect.any(Number) }),
      );
      expect(token).toBe('mock.access.token');
    });
  });
});

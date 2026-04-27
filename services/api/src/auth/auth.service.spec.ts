import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/core';
import { mockConfigService, mockUser } from '@terab/test';
import bcrypt from 'bcryptjs';
import { DeviceService } from '../device/device.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import { TwoFaService } from '../twofa/twofa.service';
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

const mockDeviceService = {
  findPushTokensByUserId: jest.fn(),
};

const mockTwoFaService = {
  createChallenge: jest.fn(),
};

const mockTrustedDeviceService = {
  verify: jest.fn(),
};

const mockPushChallengePublisher = {
  publish: jest.fn(),
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
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: TwoFaService, useValue: mockTwoFaService },
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        { provide: PushChallengePublisher, useValue: mockPushChallengePublisher },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    mockAuthRepository.insertRefreshToken.mockResolvedValue(undefined);
    mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);
    mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');
    mockTokenService.issueRefreshToken.mockReturnValue({
      rawRefreshToken: 'mock-raw-refresh-token',
      tokenHash: 'mock-token-hash',
      expiresAt: new Date(),
    });
  });

  describe('login', () => {
    it('비밀번호 불일치 시 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'user1', password: 'wrong' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('비활성 계정은 ApiException(ACCOUNT_DISABLED)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue({ ...mockUser, active: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ username: 'user1', password: 'any' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('존재하지 않는 사용자는 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('인증 성공 시 accessToken과 rawRefreshToken을 반환하고 TokenService를 호출한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'user1', password: 'correct' }, undefined, undefined);

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

    it('디바이스가 없으면 즉시 AUTHENTICATED를 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);

      const result = await service.login({ username: 'user1', password: 'pw' }, undefined, undefined);

      expect(result.response.status).toBe('AUTHENTICATED');
    });

    it('신뢰기기 토큰이 유효하면 2FA 없이 AUTHENTICATED를 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(true);

      const result = await service.login({ username: 'user1', password: 'pw' }, 'valid-trust-token', undefined);

      expect(result.response.status).toBe('AUTHENTICATED');
      expect(mockDeviceService.findPushTokensByUserId).not.toHaveBeenCalled();
    });

    it('디바이스가 있으면 2FA_REQUIRED를 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue(['push-token-abc']);
      mockTwoFaService.createChallenge.mockResolvedValue({
        id: 'challenge-id',
        options: '47,82,13',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.login({ username: 'user1', password: 'pw' }, undefined, undefined);

      expect(result.response.status).toBe('2FA_REQUIRED');
      expect(mockPushChallengePublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ pushToken: 'push-token-abc' }),
      );
    });

    it('신뢰기기 토큰이 무효하고 디바이스가 있으면 2FA_REQUIRED를 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue(['push-token-abc']);
      mockTwoFaService.createChallenge.mockResolvedValue({
        id: 'challenge-id',
        options: '47,82,13',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.login({ username: 'user1', password: 'pw' }, 'invalid-trust-token', undefined);

      expect(result.response.status).toBe('2FA_REQUIRED');
      expect(mockTrustedDeviceService.verify).toHaveBeenCalledWith('invalid-trust-token', mockUser.id);
    });
  });
});

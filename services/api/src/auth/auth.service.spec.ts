import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/core';
import { mockConfigService, mockUser } from '@terab/test';
import bcrypt from 'bcryptjs';
import { DeviceService } from '../device/device.service';
import { InvitationService } from '../invitation/invitation.service';
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
  insertBackupCodes: jest.fn(),
  registerUser: jest.fn(),
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
  claimApprovedChallenge: jest.fn(),
};

const mockTrustedDeviceService = {
  verify: jest.fn(),
};

const mockInvitationService = {
  validateOrThrow: jest.fn(),
  markUsed: jest.fn(),
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
        { provide: InvitationService, useValue: mockInvitationService },
        { provide: PushChallengePublisher, useValue: mockPushChallengePublisher },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    mockAuthRepository.insertRefreshToken.mockResolvedValue(undefined);
    mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);
    mockInvitationService.validateOrThrow.mockResolvedValue({ token: 'valid-token' });
    mockTokenService.generateAccessToken.mockReturnValue('mock.access.token');
    mockTokenService.issueRefreshToken.mockReturnValue({
      rawRefreshToken: 'mock-raw-refresh-token',
      tokenHash: 'mock-token-hash',
      expiresAt: new Date(),
    });
  });

  describe('register', () => {
    const registerDto = {
      token: '550e8400-e29b-41d4-a716-446655440000',
      username: 'newuser',
      nickname: '새유저',
      password: 'password123',
    };

    it('초대 토큰이 유효하지 않으면 ApiException을 던진다', async () => {
      mockInvitationService.validateOrThrow.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));

      await expect(service.register(registerDto)).rejects.toThrow(ApiException);
      expect(mockAuthRepository.registerUser).not.toHaveBeenCalled();
    });

    it('중복 username이면 ApiException(USERNAME_TAKEN)을 던진다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockAuthRepository.registerUser.mockRejectedValue({ code: '23505' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toThrow(ApiException);
    });

    it('성공 시 accessToken + user + backupCodes 8개를 반환한다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockAuthRepository.registerUser.mockResolvedValue({ id: 'new-user-id' });
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      mockTokenService.issueRefreshToken.mockReturnValue({
        rawRefreshToken: 'raw-rt',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 86400000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.backupCodes).toHaveLength(8);
      expect(result.user.username).toBe('newuser');
      expect(mockAuthRepository.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: registerDto.username,
          nickname: registerDto.nickname,
          roleId: 'role-id',
          invitationToken: registerDto.token,
          codeHashes: expect.arrayContaining([expect.any(String)]),
        }),
      );
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

  describe('completeTwoFa', () => {
    it('챌린지가 APPROVED 상태가 아니면 TwoFaService에서 예외가 전파된다', async () => {
      const { ApiException } = await import('@terab/common');
      mockTwoFaService.claimApprovedChallenge.mockRejectedValue(new ApiException('TWO_FA_CHALLENGE_NOT_FOUND'));

      await expect(service.completeTwoFa('challenge-id')).rejects.toThrow(ApiException);
    });

    it('APPROVED 챌린지 완료 후 AUTHENTICATED 응답과 토큰을 반환한다', async () => {
      mockTwoFaService.claimApprovedChallenge.mockResolvedValue('user-id');
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);

      const result = await service.completeTwoFa('challenge-id');

      expect(mockTwoFaService.claimApprovedChallenge).toHaveBeenCalledWith('challenge-id');
      expect(result.response.status).toBe('AUTHENTICATED');
      expect(result.rawRefreshToken).toBe('mock-raw-refresh-token');
    });

    it('userId에 해당하는 사용자가 없으면 ApiException을 던진다', async () => {
      const { ApiException } = await import('@terab/common');
      mockTwoFaService.claimApprovedChallenge.mockResolvedValue('ghost-user-id');
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(null);

      await expect(service.completeTwoFa('challenge-id')).rejects.toThrow(ApiException);
    });
  });
});

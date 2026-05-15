import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TokenService } from '@terab/security';
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
  consume: jest.fn(),
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

    it('초대 토큰이 유효하지 않으면 INVITATION_NOT_FOUND 예외를 던지고 user 생성을 호출하지 않는다', async () => {
      mockInvitationService.validateOrThrow.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
      expect(mockAuthRepository.insertUser).not.toHaveBeenCalled();
    });

    it('USER role이 없으면 ROLE_NOT_FOUND 예외를 던진다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
      expect(mockAuthRepository.insertUser).not.toHaveBeenCalled();
    });

    it('중복 username이면 USERNAME_TAKEN 예외를 던진다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockRejectedValue({ code: '23505' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
    });

    it('invitation이 이미 사용되었으면 INVITATION_ALREADY_USED 예외를 던진다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
      mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
      mockInvitationService.consume.mockRejectedValue(new ApiException('INVITATION_ALREADY_USED'));
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'INVITATION_ALREADY_USED' });
    });

    it('가입 직후 사용자 조회 실패 시 REGISTRATION_FAILED 예외를 던진다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
      mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'REGISTRATION_FAILED' });
    });

    it('성공 시 insertUser → insertUserRole → insertBackupCodes → invitationService.consume 순서로 호출한다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
      mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await service.register(registerDto);

      const order = [
        mockAuthRepository.insertUser.mock.invocationCallOrder[0],
        mockAuthRepository.insertUserRole.mock.invocationCallOrder[0],
        mockAuthRepository.insertBackupCodes.mock.invocationCallOrder[0],
        mockInvitationService.consume.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(mockInvitationService.consume).toHaveBeenCalledWith(registerDto.token, 'new-user-1');
    });

    it('성공 시 accessToken + user + backupCodes 8개를 반환한다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
      mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.backupCodes).toHaveLength(8);
      expect(result.user.username).toBe('newuser');
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

      if (result.response.status !== 'AUTHENTICATED') throw new Error('Expected AUTHENTICATED status');
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

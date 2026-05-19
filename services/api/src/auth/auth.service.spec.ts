import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import {
  mockConfigService,
  mockDatabaseService,
  mockDbTransaction,
  mockTransactionContext,
  mockUser,
  setupMockDbTransactionChain,
} from '@terab/test';
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
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
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
    setupMockDbTransactionChain();
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

    it('성공 시 user 생성 + invitation consume이 트랜잭션 안에서 수행된다', async () => {
      mockAuthRepository.findRoleByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockAuthRepository.insertUser.mockResolvedValue({ id: 'new-user-1' });
      mockAuthRepository.insertUserRole.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await service.register(registerDto);

      expect(mockDbTransaction).toHaveBeenCalled();
      const txOrder = mockDbTransaction.mock.invocationCallOrder[0];
      expect(mockAuthRepository.insertUser.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockAuthRepository.insertUserRole.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockAuthRepository.insertBackupCodes.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockInvitationService.consume.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
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

  describe('regenerateBackupCodes', () => {
    it('userId가 존재하지 않으면 INVALID_CREDENTIALS 예외를 던지고 insert 호출이 발생하지 않는다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(null);

      await expect(service.regenerateBackupCodes('ghost-id', 'pw')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(mockAuthRepository.markBackupCodeUsed).not.toHaveBeenCalled();
      expect(mockAuthRepository.insertBackupCodes).not.toHaveBeenCalled();
    });

    it('비밀번호가 일치하지 않으면 INVALID_CREDENTIALS 예외를 던지고 폐기·재발급이 일어나지 않는다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.regenerateBackupCodes(mockUser.id, 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(mockAuthRepository.markBackupCodeUsed).not.toHaveBeenCalled();
      expect(mockAuthRepository.insertBackupCodes).not.toHaveBeenCalled();
    });

    it('비활성 계정이면 ACCOUNT_DISABLED 예외를 던진다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue({ ...mockUser, active: false });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.regenerateBackupCodes(mockUser.id, 'pw')).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
    });

    it('성공 시 기존 unused 코드를 각각 markBackupCodeUsed로 폐기하고 insertBackupCodes로 8개 평문을 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockAuthRepository.findUnusedBackupCodes.mockResolvedValue([
        { id: 'bc-1', codeHash: 'h1' },
        { id: 'bc-2', codeHash: 'h2' },
        { id: 'bc-3', codeHash: 'h3' },
      ]);
      mockAuthRepository.markBackupCodeUsed.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);

      const result = await service.regenerateBackupCodes(mockUser.id, 'pw');

      expect(result).toHaveLength(8);
      expect(mockAuthRepository.markBackupCodeUsed).toHaveBeenCalledTimes(3);
      expect(mockAuthRepository.markBackupCodeUsed).toHaveBeenCalledWith('bc-1', expect.any(Date));
      expect(mockAuthRepository.markBackupCodeUsed).toHaveBeenCalledWith('bc-2', expect.any(Date));
      expect(mockAuthRepository.markBackupCodeUsed).toHaveBeenCalledWith('bc-3', expect.any(Date));
      expect(mockAuthRepository.insertBackupCodes).toHaveBeenCalledTimes(1);
      const [, hashes] = mockAuthRepository.insertBackupCodes.mock.calls[0];
      expect(hashes).toHaveLength(8);
    });

    it('성공 시 폐기 + 재발급이 동일 트랜잭션 안에서 수행된다 (tx 시작 이후 호출됨)', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockAuthRepository.findUnusedBackupCodes.mockResolvedValue([{ id: 'bc-1', codeHash: 'h1' }]);
      mockAuthRepository.markBackupCodeUsed.mockResolvedValue(undefined);
      mockAuthRepository.insertBackupCodes.mockResolvedValue(undefined);

      await service.regenerateBackupCodes(mockUser.id, 'pw');

      expect(mockDbTransaction).toHaveBeenCalled();
      const txOrder = mockDbTransaction.mock.invocationCallOrder[0];
      expect(mockAuthRepository.markBackupCodeUsed.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockAuthRepository.insertBackupCodes.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
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

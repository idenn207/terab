import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import {
  mockDatabaseService,
  mockDbTransaction,
  mockTransactionContext,
  mockUser,
  setupMockDbTransactionChain,
} from '@terab/test';
import bcrypt from 'bcryptjs';
import { DeviceService } from '../device/device.service';
import { InvitationService } from '../invitation/invitation.service';
import { RoleService } from '../role/role.service';
import { SessionService } from '../session/session.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { BackupCodeService } from '../twofa/backup-code.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import { TwoFaService } from '../twofa/twofa.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUserService = {
  findById: jest.fn(),
  findByUsername: jest.fn(),
  create: jest.fn(),
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

const mockSessionService = {
  issueForUser: jest.fn(),
  rotate: jest.fn(),
  revokeByRawToken: jest.fn(),
};

const mockBackupCodeService = {
  generateForUser: jest.fn(),
  regenerateForUser: jest.fn(),
  consume: jest.fn(),
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
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: TwoFaService, useValue: mockTwoFaService },
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        { provide: InvitationService, useValue: mockInvitationService },
        { provide: PushChallengePublisher, useValue: mockPushChallengePublisher },
        { provide: SessionService, useValue: mockSessionService },
        { provide: BackupCodeService, useValue: mockBackupCodeService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
    mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);
    mockInvitationService.validateOrThrow.mockResolvedValue({ token: 'valid-token' });
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
    mockBackupCodeService.generateForUser.mockResolvedValue([
      'CODE-0001',
      'CODE-0002',
      'CODE-0003',
      'CODE-0004',
      'CODE-0005',
      'CODE-0006',
      'CODE-0007',
      'CODE-0008',
    ]);
    mockBackupCodeService.regenerateForUser.mockResolvedValue([
      'NEW-0001',
      'NEW-0002',
      'NEW-0003',
      'NEW-0004',
      'NEW-0005',
      'NEW-0006',
      'NEW-0007',
      'NEW-0008',
    ]);
    mockBackupCodeService.consume.mockResolvedValue(undefined);
    mockRoleService.getPermissionsByUserId.mockResolvedValue(mockUser.permissions);
    mockRoleService.assignUserRole.mockResolvedValue(undefined);
    mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
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
      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    it('USER role이 없으면 ROLE_NOT_FOUND 예외를 던진다', async () => {
      mockRoleService.findByName.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    it('중복 username이면 USERNAME_TAKEN 예외를 던진다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockRejectedValue({ code: '23505' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
    });

    it('invitation이 이미 사용되었으면 INVITATION_ALREADY_USED 예외를 던진다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);
      mockInvitationService.consume.mockRejectedValue(new ApiException('INVITATION_ALREADY_USED'));
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'INVITATION_ALREADY_USED' });
    });

    it('가입 직후 사용자 조회 실패 시 REGISTRATION_FAILED 예외를 던진다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(service.register(registerDto)).rejects.toMatchObject({ code: 'REGISTRATION_FAILED' });
    });

    it('성공 시 insertUser → insertUserRole → backupCodeService.generateForUser → invitationService.consume 순서로 호출한다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await service.register(registerDto);

      const order = [
        mockUserService.create.mock.invocationCallOrder[0],
        mockRoleService.assignUserRole.mock.invocationCallOrder[0],
        mockBackupCodeService.generateForUser.mock.invocationCallOrder[0],
        mockInvitationService.consume.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(mockBackupCodeService.generateForUser).toHaveBeenCalledWith('new-user-1');
      expect(mockInvitationService.consume).toHaveBeenCalledWith(registerDto.token, 'new-user-1');
    });

    it('성공 시 accessToken + user + backupCodes 8개를 반환한다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.backupCodes).toHaveLength(8);
      expect(result.user.username).toBe('newuser');
    });

    it('성공 시 user 생성 + invitation consume이 트랜잭션 안에서 수행된다', async () => {
      mockRoleService.findByName.mockResolvedValue({ id: 'role-id' });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      mockUserService.create.mockResolvedValue({ id: 'new-user-1' });
      mockRoleService.assignUserRole.mockResolvedValue(undefined);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await service.register(registerDto);

      expect(mockDbTransaction).toHaveBeenCalled();
      const txOrder = mockDbTransaction.mock.invocationCallOrder[0];
      expect(mockUserService.create.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockRoleService.assignUserRole.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockBackupCodeService.generateForUser.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(mockInvitationService.consume.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
    });
  });

  describe('login', () => {
    it('비밀번호 불일치 시 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'user1', password: 'wrong' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('비활성 계정은 ApiException(ACCOUNT_DISABLED)을 던진다', async () => {
      mockUserService.findByUsername.mockResolvedValue({ ...mockUser, active: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ username: 'user1', password: 'any' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('존재하지 않는 사용자는 ApiException(INVALID_CREDENTIALS)을 던진다', async () => {
      mockUserService.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' }, undefined, undefined)).rejects.toThrow(
        ApiException,
      );
    });

    it('인증 성공 시 accessToken과 rawRefreshToken을 반환하고 TokenService를 호출한다', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
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
      expect(mockSessionService.issueForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('디바이스가 없으면 즉시 AUTHENTICATED를 반환한다', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);

      const result = await service.login({ username: 'user1', password: 'pw' }, undefined, undefined);

      expect(result.response.status).toBe('AUTHENTICATED');
    });

    it('신뢰기기 토큰이 유효하면 2FA 없이 AUTHENTICATED를 반환한다', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTrustedDeviceService.verify.mockResolvedValue(true);

      const result = await service.login({ username: 'user1', password: 'pw' }, 'valid-trust-token', undefined);

      expect(result.response.status).toBe('AUTHENTICATED');
      expect(mockDeviceService.findPushTokensByUserId).not.toHaveBeenCalled();
    });

    it('디바이스가 있으면 2FA_REQUIRED를 반환한다', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
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
      mockUserService.findByUsername.mockResolvedValue(mockUser);
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
    it('userId가 존재하지 않으면 INVALID_CREDENTIALS 예외를 던지고 재발급이 일어나지 않는다', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.regenerateBackupCodes('ghost-id', 'pw')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(mockBackupCodeService.regenerateForUser).not.toHaveBeenCalled();
    });

    it('비밀번호가 일치하지 않으면 INVALID_CREDENTIALS 예외를 던지고 재발급이 일어나지 않는다', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.regenerateBackupCodes(mockUser.id, 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(mockBackupCodeService.regenerateForUser).not.toHaveBeenCalled();
    });

    it('비활성 계정이면 ACCOUNT_DISABLED 예외를 던진다', async () => {
      mockUserService.findById.mockResolvedValue({ ...mockUser, active: false });
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.regenerateBackupCodes(mockUser.id, 'pw')).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
      expect(mockBackupCodeService.regenerateForUser).not.toHaveBeenCalled();
    });

    it('성공 시 BackupCodeService.regenerateForUser에 위임하고 결과를 그대로 반환한다', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockTokenService.pepperPassword.mockReturnValue('peppered');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.regenerateBackupCodes(mockUser.id, 'pw');

      expect(mockBackupCodeService.regenerateForUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveLength(8);
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
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await service.completeTwoFa('challenge-id');

      expect(mockTwoFaService.claimApprovedChallenge).toHaveBeenCalledWith('challenge-id');
      expect(result.response.status).toBe('AUTHENTICATED');
      expect(result.rawRefreshToken).toBe('mock-raw-refresh-token');
    });

    it('userId에 해당하는 사용자가 없으면 ApiException을 던진다', async () => {
      const { ApiException } = await import('@terab/common');
      mockTwoFaService.claimApprovedChallenge.mockResolvedValue('ghost-user-id');
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.completeTwoFa('challenge-id')).rejects.toThrow(ApiException);
    });
  });
});

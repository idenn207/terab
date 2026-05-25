import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbTransactionChain } from '@terab/test';
import { DeviceService } from '../device/device.service';
import { InvitationService } from '../invitation/invitation.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { BackupCodeService } from '../twofa/backup-code/backup-code.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import { TwoFaService } from '../twofa/twofa.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { LoginService } from './login.service';

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

const mockAuthService = {
  hashPassword: jest.fn(),
  assignDefaultRole: jest.fn(),
  validateCredentials: jest.fn(),
  generateAccessToken: jest.fn(),
  issueTokenPair: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
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

const mockBackupCodeService = {
  generateForUser: jest.fn(),
  regenerateForUser: jest.fn(),
  consume: jest.fn(),
};

describe('LoginService', () => {
  let service: LoginService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LoginService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: PushChallengePublisher, useValue: mockPushChallengePublisher },
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        { provide: InvitationService, useValue: mockInvitationService },
        { provide: BackupCodeService, useValue: mockBackupCodeService },
        { provide: TwoFaService, useValue: mockTwoFaService },
      ],
    }).compile();

    service = module.get(LoginService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
  });

  describe('register', () => {
    it('초대 토큰이 유효하지 않으면 InvitationService에서 예외를 던진다', async () => {
      mockInvitationService.validateOrThrow.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.register({ token: 'bad', username: 'a', nickname: 'A', password: 'p' }, res),
      ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
    });

    it('username 중복 시 USERNAME_TAKEN 예외를 던진다', async () => {
      mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
      mockAuthService.hashPassword.mockResolvedValue('hashed');
      mockUserService.create.mockRejectedValue({ code: '23505' });
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.register({ token: 't', username: 'dup', nickname: 'D', password: 'p' }, res),
      ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
    });

    it('insert 후 user가 조회되지 않으면 REGISTRATION_FAILED 예외를 던진다', async () => {
      mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
      mockAuthService.hashPassword.mockResolvedValue('hashed');
      mockUserService.create.mockResolvedValue({ id: 'u1' });
      mockAuthService.assignDefaultRole.mockResolvedValue(undefined);
      mockBackupCodeService.generateForUser.mockResolvedValue(['c1']);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.register({ token: 't', username: 'a', nickname: 'A', password: 'p' }, res),
      ).rejects.toMatchObject({ code: 'REGISTRATION_FAILED' });
    });

    it('정상 흐름 — accessToken + user + backupCodes 반환', async () => {
      mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
      mockAuthService.hashPassword.mockResolvedValue('hashed');
      mockUserService.create.mockResolvedValue({ id: 'u1' });
      mockAuthService.assignDefaultRole.mockResolvedValue(undefined);
      mockBackupCodeService.generateForUser.mockResolvedValue(['code-1', 'code-2']);
      mockInvitationService.consume.mockResolvedValue(undefined);
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        nickname: 'A',
        password: 'hashed',
        active: true,
      });
      mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
      const res = { cookie: jest.fn() } as any;

      const result = await service.register({ token: 't', username: 'alice', nickname: 'A', password: 'p' }, res);

      expect(result).toEqual({
        accessToken: 'JWT',
        user: { id: 'u1', username: 'alice', nickname: 'A' },
        backupCodes: ['code-1', 'code-2'],
      });
    });
  });

  describe('login', () => {
    it('username 없으면 INVALID_CREDENTIALS 예외를 던진다', async () => {
      mockUserService.findByUsername.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.login({ username: 'ghost', password: 'p' }, undefined, undefined, res),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('trustToken 검증 통과 시 AUTHENTICATED + 토큰 발급', async () => {
      const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
      mockUserService.findByUsername.mockResolvedValue(user);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockTrustedDeviceService.verify.mockResolvedValue(true);
      mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
      const res = { cookie: jest.fn() } as any;

      const result = await service.login({ username: 'a', password: 'p' }, 'tt', 'ua', res);

      expect(result).toEqual({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
    });

    it('push token이 없으면 2FA 없이 AUTHENTICATED', async () => {
      const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
      mockUserService.findByUsername.mockResolvedValue(user);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);
      mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
      const res = { cookie: jest.fn() } as any;

      const result = await service.login({ username: 'a', password: 'p' }, undefined, undefined, res);

      expect(result.status).toBe('AUTHENTICATED');
    });

    it('push token 존재 시 2FA_REQUIRED 챌린지 발급 + publish', async () => {
      const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
      mockUserService.findByUsername.mockResolvedValue(user);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockTrustedDeviceService.verify.mockResolvedValue(false);
      mockDeviceService.findPushTokensByUserId.mockResolvedValue(['pt-1']);
      const exp = new Date(Date.now() + 60000);
      mockTwoFaService.createChallenge.mockResolvedValue({
        id: 'ch-1',
        userId: 'u1',
        options: '1,2,3',
        correctNum: '2',
        expiresAt: exp,
        status: 'PENDING',
        respondedAt: null,
      });
      const res = { cookie: jest.fn() } as any;

      const result = await service.login({ username: 'a', password: 'p' }, undefined, undefined, res);

      expect(result).toMatchObject({
        status: '2FA_REQUIRED',
        challengeId: 'ch-1',
        options: ['1', '2', '3'],
        expiresAt: exp,
      });
      expect(mockPushChallengePublisher.publish).toHaveBeenCalled();
    });
  });

  describe('loginWithBackupCode', () => {
    it('user가 없으면 INVALID_CREDENTIALS 예외', async () => {
      mockUserService.findByUsername.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.loginWithBackupCode({ username: 'g', password: 'p', backupCode: 'c' }, res),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('정상 흐름 — backup-code 소비 후 토큰 발급', async () => {
      const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
      mockUserService.findByUsername.mockResolvedValue(user);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockBackupCodeService.consume.mockResolvedValue(undefined);
      mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
      const res = { cookie: jest.fn() } as any;

      const result = await service.loginWithBackupCode({ username: 'a', password: 'p', backupCode: 'c' }, res);

      expect(mockBackupCodeService.consume).toHaveBeenCalledWith('u1', 'c');
      expect(result).toEqual({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
    });
  });

  describe('refresh', () => {
    it('rotation 후 user가 없으면 REFRESH_TOKEN_INVALID 예외', async () => {
      mockAuthService.rotateRefreshToken.mockResolvedValue({ userId: 'ghost' });
      mockUserService.findById.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(service.refresh('rt', res)).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALID',
      });
    });

    it('정상 흐름 — 새 accessToken + AUTHENTICATED 응답', async () => {
      mockAuthService.rotateRefreshToken.mockResolvedValue({ userId: 'u1' });
      mockUserService.findById.mockResolvedValue({
        id: 'u1',
        username: 'a',
        nickname: 'A',
        password: 'h',
        active: true,
      });
      mockAuthService.generateAccessToken.mockResolvedValue('JWT');
      const res = { cookie: jest.fn() } as any;

      const result = await service.refresh('rt', res);

      expect(result).toEqual({
        status: 'AUTHENTICATED',
        accessToken: 'JWT',
        user: { id: 'u1', username: 'a', nickname: 'A' },
      });
    });
  });

  describe('logout', () => {
    it('authService.revokeRefreshToken에 위임한다', async () => {
      const res = { clearCookie: jest.fn() } as any;
      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout('rt', res);

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('rt', res);
    });
  });
});

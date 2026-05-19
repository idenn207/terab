import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { TokenService } from '@terab/security';
import bcrypt from 'bcryptjs';
import { UserDto } from '../common/dto';
import { BackupCodeService } from '../backup-code/backup-code.service';
import { DeviceService } from '../device/device.service';
import { InvitationService } from '../invitation/invitation.service';
import { RoleService } from '../role/role.service';
import { SessionService } from '../session/session.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import { TwoFaService } from '../twofa/twofa.service';
import { UserService } from '../user/user.service';
import { BackupLoginBodyDto, LoginBodyDto, LoginResponse, RegisterBodyDto, RegisterResponseDto } from './dto';
import { UserWithPermissions } from './types/user-with-permissions.type';

interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

@Injectable()
export class AuthService extends ServiceCore {
  protected readonly BCRYPT_ROUNDS = 10;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly pushChallengePublisher: PushChallengePublisher,
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly invitationService: InvitationService,
    private readonly sessionService: SessionService,
    private readonly backupCodeService: BackupCodeService,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {
    super(database, txContext);
  }

  // ─── Register ────────────────────────────────────────────────────────

  @LogReplay()
  async register(
    data: RegisterBodyDto,
  ): Promise<RegisterResponseDto & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>> {
    await this.invitationService.validateOrThrow(data.token);

    const userRole = await this.roleService.findByName('USER');
    if (!userRole) throw new ApiException('ROLE_NOT_FOUND');

    const pepperedPassword = this.tokenService.pepperPassword(data.password);
    const hashedPassword = await bcrypt.hash(pepperedPassword, this.BCRYPT_ROUNDS);

    let rawCodes!: string[];
    const newUser = await this.runInTx(async () => {
      const inserted = await this.userService
        .create({
          username: data.username,
          nickname: data.nickname,
          password: hashedPassword,
        })
        .catch((err: { code?: string }) => {
          if (err.code === '23505') throw new ApiException('USERNAME_TAKEN');
          throw err;
        });
      await this.roleService.assignUserRole(inserted.id, userRole.id);
      rawCodes = await this.backupCodeService.generateForUser(inserted.id);
      await this.invitationService.consume(data.token, inserted.id);
      return inserted;
    });

    const userWithPermissions = await this.findUserWithPermissionsById(newUser.id);
    if (!userWithPermissions) throw new ApiException('REGISTRATION_FAILED');

    const tokens = await this.issueTokenPair(userWithPermissions);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: newUser.id,
        username: data.username,
        nickname: data.nickname,
      },
      backupCodes: rawCodes,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────

  @LogReplay({ captureResult: true })
  async login(
    data: LoginBodyDto,
    trustToken: string | undefined,
    _userAgent: string | undefined,
  ): Promise<
    {
      response: LoginResponse;
    } & Partial<Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>>
  > {
    const user = await this.findUserWithPermissionsByUsername(data.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, data.password);

    // 신뢰기기 쿠키 유효 시 2FA 스킵
    if (trustToken && (await this.trustedDeviceService.verify(trustToken, user.id))) {
      const tokens = await this.issueTokenPair(user);
      return {
        response: {
          status: 'AUTHENTICATED',
          accessToken: tokens.accessToken,
          user: {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
          },
        },
        rawRefreshToken: tokens.rawRefreshToken,
        refreshTokenExpMs: tokens.refreshTokenExpMs,
      };
    }

    // pushToken 없으면 2FA 스킵
    const pushTokens = await this.deviceService.findPushTokensByUserId(user.id);
    if (pushTokens.length === 0) {
      const tokens = await this.issueTokenPair(user);
      return {
        response: {
          status: 'AUTHENTICATED',
          accessToken: tokens.accessToken,
          user: {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
          },
        },
        rawRefreshToken: tokens.rawRefreshToken,
        refreshTokenExpMs: tokens.refreshTokenExpMs,
      };
    }

    // 2FA 챌린지 생성 + BullMQ 발행
    const challenge = await this.twoFaService.createChallenge(user.id);
    await Promise.all(
      pushTokens.map((pushToken) =>
        this.pushChallengePublisher.publish({
          userId: user.id,
          pushToken,
          challengeId: challenge.id,
          options: challenge.options,
          expiresAt: challenge.expiresAt.toISOString(),
        }),
      ),
    );

    return {
      response: {
        status: '2FA_REQUIRED',
        challengeId: challenge.id,
        options: challenge.options.split(','),
        expiresAt: challenge.expiresAt,
      },
    };
  }

  async completeTwoFa(challengeId: string): Promise<
    {
      response: LoginResponse;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    const userId = await this.twoFaService.claimApprovedChallenge(challengeId);
    const user = await this.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    const tokens = await this.issueTokenPair(user);
    return {
      response: {
        status: 'AUTHENTICATED',
        accessToken: tokens.accessToken,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        },
      },
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  async loginWithBackupCode(data: BackupLoginBodyDto): Promise<
    {
      response: LoginResponse;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    const user = await this.findUserWithPermissionsByUsername(data.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, data.password);
    await this.backupCodeService.consume(user.id, data.backupCode);

    const tokens = await this.issueTokenPair(user);
    return {
      response: {
        status: 'AUTHENTICATED',
        accessToken: tokens.accessToken,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        },
      },
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  // ─── Refresh ─────────────────────────────────────────────────────────

  @LogReplay({ captureResult: true })
  async refresh(rawRefreshToken: string | undefined): Promise<
    {
      response: LoginResponse;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    if (!rawRefreshToken) throw new ApiException('REFRESH_TOKEN_INVALID');

    const rotated = await this.sessionService.rotate(rawRefreshToken);

    const user = await this.findUserWithPermissionsById(rotated.userId);
    if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');

    const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
    return {
      response: {
        status: 'AUTHENTICATED',
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        },
      },
      rawRefreshToken: rotated.rawRefreshToken,
      refreshTokenExpMs: rotated.refreshTokenExpMs,
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  @LogReplay()
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.sessionService.revokeByRawToken(rawRefreshToken);
  }

  // ─── Me ──────────────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await this.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
    };
  }

  // ─── 사용자+권한 합성 ────────────────────────────────────────────────
  private async findUserWithPermissionsById(id: string): Promise<UserWithPermissions | null> {
    const user = await this.userService.findById(id);
    if (!user) return null;
    const permissions = await this.roleService.getPermissionsByUserId(user.id);
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      password: user.password,
      active: user.active,
      permissions,
    };
  }

  private async findUserWithPermissionsByUsername(username: string): Promise<UserWithPermissions | null> {
    const user = await this.userService.findByUsername(username);
    if (!user) return null;
    const permissions = await this.roleService.getPermissionsByUserId(user.id);
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      password: user.password,
      active: user.active,
      permissions,
    };
  }

  // ─── 내부 인증 로직 ──────────────────────────────────────────────────
  private async validateCredentials(user: UserWithPermissions, rawPassword: string): Promise<void> {
    const pepperedPassword = this.tokenService.pepperPassword(rawPassword);
    const valid = await bcrypt.compare(pepperedPassword, user.password);
    if (!valid) throw new ApiException('INVALID_CREDENTIALS');
    if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
  }

  // ─── 내부 비즈니스 로직 ──────────────────────────────────────────────

  private async issueTokenPair(user: UserWithPermissions): Promise<AuthTokens> {
    const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
    const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(user.id);
    return {
      accessToken,
      rawRefreshToken,
      refreshTokenExpMs,
    };
  }

  // ─── Backup Code 재발급 ──────────────────────────────────────────────

  @LogReplay()
  async regenerateBackupCodes(userId: string, currentPassword: string): Promise<string[]> {
    const user = await this.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, currentPassword);
    return this.backupCodeService.regenerateForUser(userId);
  }
}

import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import type { Response } from 'express';
import { DeviceService } from '../device/device.service';
import { InvitationService } from '../invitation/invitation.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { BackupCodeService } from '../twofa/backup-code/backup-code.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import { TwoFaService } from '../twofa/twofa.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import type { BackupLoginBodyDto, LoginBodyDto, LoginResponse, RegisterBodyDto, RegisterResponseDto } from './dto';

@Injectable()
export class LoginService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,

    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly pushChallengePublisher: PushChallengePublisher,
    private readonly deviceService: DeviceService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly invitationService: InvitationService,
    private readonly backupCodeService: BackupCodeService,
    private readonly twoFaService: TwoFaService,
  ) {
    super(database, txContext);
  }

  // ─── Register ────────────────────────────────────────────────────────

  @LogReplay()
  async register(data: RegisterBodyDto, res: Response): Promise<RegisterResponseDto> {
    let rawCodes!: string[];

    const { id } = await this.runInTx(async () => {
      await this.invitationService.validateOrThrow(data.token);

      const hashedPassword = await this.authService.hashPassword(data.password);
      const inserted = await this.userService
        .create({ username: data.username, nickname: data.nickname, password: hashedPassword })
        .catch((err: { code?: string }) => {
          if (err.code === '23505') throw new ApiException('USERNAME_TAKEN');
          throw err;
        });
      await this.authService.assignDefaultRole(inserted.id);
      rawCodes = await this.backupCodeService.generateForUser(inserted.id);
      await this.invitationService.consume(data.token, inserted.id);
      return inserted;
    });

    const user = await this.userService.findById(id);
    if (!user) throw new ApiException('REGISTRATION_FAILED');

    const { accessToken } = await this.authService.issueTokenPair(user, res);

    return {
      accessToken,
      user: await this.authService.buildUserResponse(user),
      backupCodes: rawCodes,
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────

  @LogReplay({ captureResult: true })
  async login(
    data: LoginBodyDto,
    trustToken: string | undefined,
    userAgent: string | undefined,
    res: Response,
  ): Promise<LoginResponse> {
    const user = await this.userService.findByUsername(data.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');

    await this.authService.validateCredentials(user, data.password);

    // 신뢰기기 쿠키 유효 시 2FA 스킵 (verify 가 sliding window 자동 갱신)
    if (trustToken && (await this.trustedDeviceService.verify(trustToken, user.id))) {
      const { accessToken } = await this.authService.issueTokenPair(user, res);
      return {
        status: 'AUTHENTICATED',
        accessToken,
        user: await this.authService.buildUserResponse(user),
      };
    }

    // pushToken 없으면 2FA 스킵 — 모바일 첫 로그인 시 trustDevice=true 면 같은 흐름에서 trust 등록(atomic)
    const pushTokens = await this.deviceService.findPushTokensByUserId(user.id);
    if (pushTokens.length === 0) {
      return this.runInTx(async () => {
        const { accessToken } = await this.authService.issueTokenPair(user, res);
        if (data.trustDevice) {
          const rawTrustToken = await this.trustedDeviceService.register(user.id, userAgent);
          this.authService.setTrustCookie(res, rawTrustToken, this.trustedDeviceService.trustDurationMs);
        }
        return {
          status: 'AUTHENTICATED' as const,
          accessToken,
          user: await this.authService.buildUserResponse(user),
        };
      });
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
      status: '2FA_REQUIRED',
      challengeId: challenge.id,
      options: challenge.options.split(','),
      expiresAt: challenge.expiresAt,
    };
  }

  async loginWithBackupCode(body: BackupLoginBodyDto, res: Response): Promise<LoginResponse> {
    const user = await this.userService.findByUsername(body.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.authService.validateCredentials(user, body.password);
    await this.backupCodeService.consume(user.id, body.backupCode);
    const { accessToken } = await this.authService.issueTokenPair(user, res);
    return {
      status: 'AUTHENTICATED',
      accessToken,
      user: await this.authService.buildUserResponse(user),
    };
  }

  // ─── Refresh ─────────────────────────────────────────────────────────

  @LogReplay({ captureResult: true })
  async refresh(rawRt: string | undefined, res: Response): Promise<LoginResponse> {
    const { userId } = await this.authService.rotateRefreshToken(rawRt, res);
    const user = await this.userService.findById(userId);
    if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');
    const accessToken = await this.authService.generateAccessToken(user);
    return {
      status: 'AUTHENTICATED',
      accessToken,
      user: await this.authService.buildUserResponse(user),
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  @LogReplay()
  async logout(rawRt: string | undefined, pushToken: string | undefined, res: Response): Promise<void> {
    const { userId } = await this.authService.revokeRefreshToken(rawRt, res);
    if (userId && pushToken) {
      await this.deviceService.deactivateByPushToken(userId, pushToken);
    }
  }

  // // ─── Backup Code 재발급 ──────────────────────────────────────────────

  // @LogReplay()
  // async regenerateBackupCodes(userId: string, currentPassword: string): Promise<string[]> {
  //   const user = await this.findUserWithPermissionsById(userId);
  //   if (!user) throw new ApiException('INVALID_CREDENTIALS');
  //   await this.validateCredentials(user, currentPassword);
  //   return this.backupCodeService.regenerateForUser(userId);
  // }
}

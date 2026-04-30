import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { contract } from '@terab/contract';
import { TokenService } from '@terab/core';
import { ServerInferRequest, ServerInferResponseBody } from '@ts-rest/core';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { DeviceService } from '../device/device.service.js';
import { InvitationService } from '../invitation/invitation.service.js';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service.js';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher.js';
import { TwoFaService } from '../twofa/twofa.service.js';
import { AuthRepository, UserWithPermissions } from './auth.repository.js';

interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  protected readonly BCRYPT_ROUNDS = 10;

  constructor(
    private readonly pushChallengePublisher: PushChallengePublisher,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly invitationService: InvitationService,
    private readonly authRepository: AuthRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initOwnerAccount();
  }

  // ─── Register ────────────────────────────────────────────────────────

  async register(
    data: ServerInferRequest<typeof contract.auth.register>['body'],
  ): Promise<
    ServerInferResponseBody<typeof contract.auth.register> & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    await this.invitationService.validateOrThrow(data.token);

    const userRole = await this.authRepository.findRoleByName('USER');
    if (!userRole) throw new Error('USER 역할 없음 - 마이그레이션 실행 여부를 확인하세요');

    const pepperedPassword = this.tokenService.pepperPassword(data.password);
    const hashedPassword = await bcrypt.hash(pepperedPassword, this.BCRYPT_ROUNDS);

    const rawCodes = this.generateBackupCodes();
    const codeHashes = await Promise.all(rawCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS)));

    let newUser: { id: string };
    try {
      newUser = await this.authRepository.registerUser({
        username: data.username,
        nickname: data.nickname,
        password: hashedPassword,
        roleId: userRole.id,
        codeHashes,
        invitationToken: data.token,
      });
    } catch (err) {
      if (err instanceof ConflictException) throw new ApiException('INVITATION_ALREADY_USED');
      if ((err as { code?: string }).code === '23505') throw new ApiException('USERNAME_TAKEN');
      throw err;
    }

    const userWithPermissions = await this.authRepository.findUserWithPermissionsById(newUser.id);
    if (!userWithPermissions) throw new Error('가입 직후 사용자 조회 실패');

    const tokens = await this.issueTokenPair(userWithPermissions);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: newUser.id,
        nickname: data.username,
        username: data.nickname,
      },
      backupCodes: rawCodes,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────

  async login(
    data: ServerInferRequest<typeof contract.auth.login>['body'],
    trustToken: string | undefined,
    userAgent: string | undefined,
  ): Promise<
    {
      response: ServerInferResponseBody<typeof contract.auth.login>;
    } & Partial<Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>>
  > {
    const user = await this.authRepository.findUserWithPermissionsByUsername(data.username);
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
      response: ServerInferResponseBody<typeof contract.auth.login>;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    const userId = await this.twoFaService.claimApprovedChallenge(challengeId);
    const user = await this.authRepository.findUserWithPermissionsById(userId);
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

  async loginWithBackupCode(data: ServerInferRequest<typeof contract.auth.loginWithBackup>['body']): Promise<
    {
      response: ServerInferResponseBody<typeof contract.auth.login>;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    const user = await this.authRepository.findUserWithPermissionsByUsername(data.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, data.password);
    await this.verifyAndConsumeBackupCode(user.id, data.backupCode);

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

  async refresh(rawRefreshToken: string | undefined): Promise<
    {
      response: ServerInferResponseBody<typeof contract.auth.login>;
    } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  > {
    if (!rawRefreshToken) throw new ApiException('REFRESH_TOKEN_INVALID');

    const now = new Date();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    // UUID 기반 토큰은 userId 클레임이 없으므로 family invalidation 불가
    // TODO: RT를 JWT로 변경하면 subject에서 userId 추출 후 전체 폐기 가능
    const matched = await this.authRepository.findActiveRefreshTokenByHash(tokenHash, now);

    if (!matched) {
      throw new ApiException('REFRESH_TOKEN_INVALID');
    }

    await this.authRepository.revokeRefreshTokenById(matched.id, now);

    const user = await this.authRepository.findUserWithPermissionsById(matched.userId);
    if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');

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

  // ─── Logout ──────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const now = new Date();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const matched = await this.authRepository.findActiveRefreshTokenByHash(tokenHash, now);
    if (matched) {
      await this.authRepository.revokeRefreshTokenById(matched.id, now);
    }
  }

  // ─── Me ──────────────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<ServerInferResponseBody<typeof contract.auth.me>> {
    const user = await this.authRepository.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
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
    const { rawRefreshToken, tokenHash, expiresAt } = this.tokenService.issueRefreshToken();
    const refreshTokenExpMs = this.tokenService.refreshExpMs;
    await this.authRepository.insertRefreshToken({ userId: user.id, tokenHash: tokenHash, expiresAt: expiresAt });
    return {
      accessToken,
      rawRefreshToken,
      refreshTokenExpMs,
    };
  }

  private async verifyAndConsumeBackupCode(userId: string, inputCode: string): Promise<void> {
    const codes = await this.authRepository.findUnusedBackupCodes(userId);
    // 타이밍 오라클 방지 — 매칭 여부와 무관하게 모든 코드를 순회
    let matchedId: string | null = null;
    for (const code of codes) {
      const match = await bcrypt.compare(inputCode, code.codeHash);
      if (match && matchedId === null) {
        matchedId = code.id;
      }
    }
    if (matchedId === null) throw new ApiException('BACKUP_CODE_INVALID');
    await this.authRepository.markBackupCodeUsed(matchedId, new Date());
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => {
      const buf = randomBytes(4);
      const hex = buf.toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4)}`;
    });
  }

  // ─── Owner 계정 초기화 ───────────────────────────────────────────────

  private async initOwnerAccount(): Promise<void> {
    const ownerPassword = this.configService.get<string>('OWNER_PASSWORD');
    if (!ownerPassword) return;

    const ownerUsername = this.configService.get<string>('OWNER_USERNAME') ?? 'owner';
    const ownerNickname = this.configService.get<string>('OWNER_NICKNAME') ?? 'Owner';

    const existing = await this.authRepository.findUserByUsername(ownerUsername);
    if (existing) return;

    const ownerRole = await this.authRepository.findRoleByName('OWNER');
    if (!ownerRole) throw new Error('OWNER role 없음 — 마이그레이션 실행 여부를 확인하세요');

    const hashedPassword = await bcrypt.hash(this.tokenService.pepperPassword(ownerPassword), this.BCRYPT_ROUNDS);
    try {
      const newUser = await this.authRepository.insertUser({
        username: ownerUsername,
        nickname: ownerNickname,
        password: hashedPassword,
      });
      await this.authRepository.insertUserRole(newUser.id, ownerRole.id);
    } catch (err) {
      if ((err as { code?: string }).code !== '23505') throw err;
      // 동시 기동 시 UNIQUE 충돌 무시 (다른 인스턴스가 먼저 생성)
    }
  }
}

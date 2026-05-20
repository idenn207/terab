import { Injectable } from '@nestjs/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Insert, Users$Select } from '@terab/db';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userRepository: UserRepository,
    // private readonly pushChallengePublisher: PushChallengePublisher,
    // private readonly deviceService: DeviceService,
    // private readonly trustedDeviceService: TrustedDeviceService,
    // private readonly invitationService: InvitationService,
  ) {
    super(database, txContext);
  }

  async findById(id: string): Promise<Users$Select | null> {
    return this.userRepository.findById(id);
  }

  async findByUsername(username: string): Promise<Users$Select | null> {
    return this.userRepository.findByUsername(username);
  }

  async create(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>): Promise<{ id: string }> {
    return this.userRepository.insert(data);
  }

  // ─── Register ────────────────────────────────────────────────────────

  // @LogReplay()
  // async register(
  //   data: RegisterBodyDto,
  // ): Promise<RegisterResponseDto & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>> {
  //   await this.invitationService.validateOrThrow(data.token);

  //   const userRole = await this.roleService.findByName('USER');
  //   if (!userRole) throw new ApiException('ROLE_NOT_FOUND');

  //   const pepperedPassword = this.tokenService.pepperPassword(data.password);
  //   const hashedPassword = await bcrypt.hash(pepperedPassword, this.BCRYPT_ROUNDS);

  //   let rawCodes!: string[];
  //   const newUser = await this.runInTx(async () => {
  //     const inserted = await this.userService
  //       .create({
  //         username: data.username,
  //         nickname: data.nickname,
  //         password: hashedPassword,
  //       })
  //       .catch((err: { code?: string }) => {
  //         if (err.code === '23505') throw new ApiException('USERNAME_TAKEN');
  //         throw err;
  //       });
  //     await this.roleService.assignUserRole(inserted.id, userRole.id);
  //     rawCodes = await this.backupCodeService.generateForUser(inserted.id);
  //     await this.invitationService.consume(data.token, inserted.id);
  //     return inserted;
  //   });

  //   const userWithPermissions = await this.findUserWithPermissionsById(newUser.id);
  //   if (!userWithPermissions) throw new ApiException('REGISTRATION_FAILED');

  //   const tokens = await this.issueTokenPair(userWithPermissions);

  //   return {
  //     accessToken: tokens.accessToken,
  //     user: {
  //       id: newUser.id,
  //       username: data.username,
  //       nickname: data.nickname,
  //     },
  //     backupCodes: rawCodes,
  //     rawRefreshToken: tokens.rawRefreshToken,
  //     refreshTokenExpMs: tokens.refreshTokenExpMs,
  //   };
  // }

  // // ─── Login ───────────────────────────────────────────────────────────

  // @LogReplay({ captureResult: true })
  // async login(
  //   data: LoginBodyDto,
  //   trustToken: string | undefined,
  //   _userAgent: string | undefined,
  // ): Promise<
  //   {
  //     response: LoginResponse;
  //   } & Partial<Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>>
  // > {
  //   const user = await this.findUserWithPermissionsByUsername(data.username);
  //   if (!user) throw new ApiException('INVALID_CREDENTIALS');
  //   await this.validateCredentials(user, data.password);

  //   // 신뢰기기 쿠키 유효 시 2FA 스킵
  //   if (trustToken && (await this.trustedDeviceService.verify(trustToken, user.id))) {
  //     const tokens = await this.issueTokenPair(user);
  //     return {
  //       response: {
  //         status: 'AUTHENTICATED',
  //         accessToken: tokens.accessToken,
  //         user: {
  //           id: user.id,
  //           username: user.username,
  //           nickname: user.nickname,
  //         },
  //       },
  //       rawRefreshToken: tokens.rawRefreshToken,
  //       refreshTokenExpMs: tokens.refreshTokenExpMs,
  //     };
  //   }

  //   // pushToken 없으면 2FA 스킵
  //   const pushTokens = await this.deviceService.findPushTokensByUserId(user.id);
  //   if (pushTokens.length === 0) {
  //     const tokens = await this.issueTokenPair(user);
  //     return {
  //       response: {
  //         status: 'AUTHENTICATED',
  //         accessToken: tokens.accessToken,
  //         user: {
  //           id: user.id,
  //           username: user.username,
  //           nickname: user.nickname,
  //         },
  //       },
  //       rawRefreshToken: tokens.rawRefreshToken,
  //       refreshTokenExpMs: tokens.refreshTokenExpMs,
  //     };
  //   }

  //   // 2FA 챌린지 생성 + BullMQ 발행
  //   const challenge = await this.twoFaService.createChallenge(user.id);
  //   await Promise.all(
  //     pushTokens.map((pushToken) =>
  //       this.pushChallengePublisher.publish({
  //         userId: user.id,
  //         pushToken,
  //         challengeId: challenge.id,
  //         options: challenge.options,
  //         expiresAt: challenge.expiresAt.toISOString(),
  //       }),
  //     ),
  //   );

  //   return {
  //     response: {
  //       status: '2FA_REQUIRED',
  //       challengeId: challenge.id,
  //       options: challenge.options.split(','),
  //       expiresAt: challenge.expiresAt,
  //     },
  //   };
  // }

  // // ─── Refresh ─────────────────────────────────────────────────────────

  // @LogReplay({ captureResult: true })
  // async refresh(rawRefreshToken: string | undefined): Promise<
  //   {
  //     response: LoginResponse;
  //   } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  // > {
  //   if (!rawRefreshToken) throw new ApiException('REFRESH_TOKEN_INVALID');

  //   const rotated = await this.sessionService.rotate(rawRefreshToken);

  //   const user = await this.findUserWithPermissionsById(rotated.userId);
  //   if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');

  //   const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
  //   return {
  //     response: {
  //       status: 'AUTHENTICATED',
  //       accessToken,
  //       user: {
  //         id: user.id,
  //         username: user.username,
  //         nickname: user.nickname,
  //       },
  //     },
  //     rawRefreshToken: rotated.rawRefreshToken,
  //     refreshTokenExpMs: rotated.refreshTokenExpMs,
  //   };
  // }

  // // ─── Logout ──────────────────────────────────────────────────────────

  // @LogReplay()
  // async logout(rawRefreshToken: string | undefined): Promise<void> {
  //   if (!rawRefreshToken) return;
  //   await this.sessionService.revokeByRawToken(rawRefreshToken);
  // }

  // // ─── Me ──────────────────────────────────────────────────────────────

  // async getCurrentUser(userId: string): Promise<UserDto> {
  //   const user = await this.findUserWithPermissionsById(userId);
  //   if (!user) throw new ApiException('INVALID_CREDENTIALS');
  //   return {
  //     id: user.id,
  //     username: user.username,
  //     nickname: user.nickname,
  //   };
  // }

  // async loginWithBackupCode(data: BackupLoginBodyDto): Promise<
  //   {
  //     response: LoginResponse;
  //   } & Pick<AuthTokens, 'rawRefreshToken' | 'refreshTokenExpMs'>
  // > {
  //   const user = await this.findUserWithPermissionsByUsername(data.username);
  //   if (!user) throw new ApiException('INVALID_CREDENTIALS');
  //   await this.validateCredentials(user, data.password);
  //   await this.backupCodeService.consume(user.id, data.backupCode);

  //   const tokens = await this.issueTokenPair(user);
  //   return {
  //     response: {
  //       status: 'AUTHENTICATED',
  //       accessToken: tokens.accessToken,
  //       user: {
  //         id: user.id,
  //         username: user.username,
  //         nickname: user.nickname,
  //       },
  //     },
  //     rawRefreshToken: tokens.rawRefreshToken,
  //     refreshTokenExpMs: tokens.refreshTokenExpMs,
  //   };
  // }

  // // ─── Backup Code 재발급 ──────────────────────────────────────────────

  // @LogReplay()
  // async regenerateBackupCodes(userId: string, currentPassword: string): Promise<string[]> {
  //   const user = await this.findUserWithPermissionsById(userId);
  //   if (!user) throw new ApiException('INVALID_CREDENTIALS');
  //   await this.validateCredentials(user, currentPassword);
  //   return this.backupCodeService.regenerateForUser(userId);
  // }
}

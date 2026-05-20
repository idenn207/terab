import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { TokenService } from '@terab/security';
import { AuthService } from '../auth/auth.service';
import { type ChallengeStatusResponse, ResendChallengeResponseDto } from './dto';
import { TwoFaStrategyType } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaRepository } from './twofa.repository';

@Injectable()
export class TwoFaService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly registry: TwoFaStrategyRegistry,
  ) {
    super(database, txContext);
  }

  @LogReplay()
  async createChallenge(userId: string) {
    const push = this.registry.get('PUSH');
    return push.createChallenge(userId) as ReturnType<TwoFaRepository['insert']>;
  }

  async getStatus(challengeId: string): Promise<ChallengeStatusResponse> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');

    if (challenge.status === 'PENDING' && challenge.expiresAt <= new Date()) {
      await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
      return { status: 'EXPIRED' };
    }

    if (challenge.status === 'PENDING') {
      const remainingSeconds = Math.max(0, Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000));
      return {
        status: 'PENDING',
        options: challenge.options.split(','),
        correctNum: challenge.correctNum,
        remainingSeconds,
      };
    }

    if (challenge.status === 'APPROVED') {
      const user = await this.twoFaRepository.findUserWithPermissionsById(challenge.userId);
      if (!user) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
      const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
      return {
        status: 'APPROVED',
        accessToken,
        user: {
          id: user.id,
          nickname: user.nickname,
          username: user.username,
        },
      };
    }

    return { status: 'DENIED' };
  }

  @LogReplay()
  async respond(challengeId: string, userId: string, selectedNumber: string): Promise<void> {
    const push = this.registry.get('PUSH');
    await push.verifyResponse(userId, challengeId, { selectedNumber });
  }

  @LogReplay()
  async claimApprovedChallenge(challengeId: string): Promise<string> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge || challenge.status !== 'APPROVED') throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
    return challenge.userId;
  }

  @LogReplay()
  async resend(oldChallengeId: string): Promise<ResendChallengeResponseDto> {
    const old = await this.twoFaRepository.findById(oldChallengeId);
    if (!old) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    if (old.status === 'PENDING') {
      await this.twoFaRepository.updateStatus(oldChallengeId, 'EXPIRED');
    }
    const challenge = await this.createChallenge(old.userId);
    return { challengeId: challenge.id, options: challenge.options.split(','), expiresAt: challenge.expiresAt };
  }

  // constructor 매개변수 추가 (clientside):
  // 새로 필요: TotpRepository(혹은 strategy를 직접 inject해도 됨)

  @LogReplay()
  async completeChallenge(challengeId: string, body: { type?: 'PUSH' | 'TOTP'; code?: string }): Promise<string> {
    const type: TwoFaStrategyType = body.type ?? 'PUSH';

    if (type === 'PUSH') {
      return this.claimApprovedChallenge(challengeId);
    }

    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
      throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    }

    const strategy = this.registry.get(type);
    await strategy.verifyResponse(challenge.userId, challengeId, { code: body.code ?? '' });

    await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
    return challenge.userId;
  }

  async removeStrategy(userId: string, type: TwoFaStrategyType, id: string): Promise<void> {
    const remaining = await this.countRemainingNonPushStrategiesExcluding(userId, type, id);
    if (remaining === 0) throw new ApiException('TWOFA_LAST_STRATEGY_CANNOT_REMOVE');
    const strategy = this.registry.get(type);
    await strategy.revoke(userId, id);
  }

  // async issueAuthenticatedResponse(userId: string): Promise<{
  //   response: LoginResponse;
  //   rawRefreshToken: string;
  //   refreshTokenExpMs: number;
  // }> {
  //   // 기존 completeTwoFa의 token/Refresh 발급 로직을 그대로 이관.
  //   // 구체 코드는 기존 completeTwoFa 본문을 옮기면 됨.
  //   const user = await this.userService.findById(userId);
  //   if (!user) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
  //   const userPermissions = await this.authService.findUserWithPermissions(user);
  //   const tokens = await this.authService.issueTokenPair(userPermissions);
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

  private async countRemainingNonPushStrategiesExcluding(
    userId: string,
    excludeType: TwoFaStrategyType,
    excludeId: string,
  ): Promise<number> {
    const types: TwoFaStrategyType[] = ['TOTP', 'BACKUP_CODE'];
    let count = 0;
    for (const t of types) {
      if (t === excludeType) {
        const instances = await this.registry.get(t).list(userId);
        count += instances.filter((i) => i.id !== excludeId).length;
      } else {
        const instances = await this.registry.get(t).list(userId);
        count += instances.length;
      }
    }
    return count;
  }
}

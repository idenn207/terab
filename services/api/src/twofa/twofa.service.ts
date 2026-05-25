import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { LoginResponse } from '../auth/dto';
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
      return { status: 'APPROVED', userId: challenge.userId };
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

  async issueAuthenticatedResponse(userId: string, res: Response): Promise<LoginResponse> {
    return await this.authService.issueAfterTwoFa(userId, res);
  }

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

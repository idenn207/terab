import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { randomInt } from 'node:crypto';
import { TwoFaRepository } from '../twofa.repository';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface PushChallengePayload {
  id: string;
  userId: string;
  options: string;
  correctNum: string;
  expiresAt: Date;
}

interface PushResponsePayload {
  selectedNumber: string;
}

@Injectable()
export class PushTwoFaStrategy
  extends ServiceCore
  implements TwoFaStrategy<never, PushChallengePayload, PushResponsePayload>
{
  readonly type: TwoFaStrategyType = 'PUSH';

  private readonly CHALLENGE_EXPIRY_MS = 60_000;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
  ) {
    super(database, txContext);
  }

  async startSetup(_userId: string): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(_userId: string, _payload: unknown): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(userId: string): Promise<PushChallengePayload> {
    const optionNums = this.generateOptions();
    const options = optionNums.join(',');
    const correctNum = optionNums[randomInt(3)].toString();
    const expiresAt = new Date(Date.now() + this.CHALLENGE_EXPIRY_MS);
    return this.twoFaRepository.insert({ userId, options, correctNum, expiresAt });
  }

  async verifyResponse(userId: string, challengeId: string, payload: PushResponsePayload): Promise<boolean> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    if (challenge.userId !== userId) throw new ApiException('FORBIDDEN');
    if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) return false;

    if (challenge.correctNum === payload.selectedNumber) {
      await this.twoFaRepository.updateStatus(challengeId, 'APPROVED', new Date());
      return true;
    }
    await this.twoFaRepository.updateStatus(challengeId, 'DENIED', new Date());
    return false;
  }

  async list(_userId: string): Promise<TwoFaStrategyInstance[]> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async revoke(_userId: string, _id: string): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  private generateOptions(): number[] {
    const nums = new Set<number>();
    while (nums.size < 3) {
      nums.add(10 + randomInt(90));
    }
    return [...nums];
  }
}

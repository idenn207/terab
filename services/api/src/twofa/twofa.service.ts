import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { LogReplay } from '@terab/logger';
import { TokenService } from '@terab/security';
import { randomInt } from 'node:crypto';
import { type ChallengeStatusResponse, ResendChallengeResponseDto } from './dto';
import { TwoFaRepository } from './twofa.repository';

@Injectable()
export class TwoFaService extends ServiceCore {
  private CHALLENGE_EXPIRY_MS = 60_000; // 60s
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly twoFaRepository: TwoFaRepository,
    private readonly tokenService: TokenService,
  ) {
    super(database, txContext);
  }

  @LogReplay()
  async createChallenge(userId: string) {
    const optionNums = this.generateOptions();
    const options = optionNums.join(',');
    const correctNum = optionNums[randomInt(3)].toString();
    const expiresAt = new Date(Date.now() + this.CHALLENGE_EXPIRY_MS);
    return this.twoFaRepository.insert({ userId, options, correctNum, expiresAt });
  }

  async getStatus(challengeId: string): Promise<ChallengeStatusResponse> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');

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
      if (!user) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
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
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (challenge.userId !== userId) throw new ApiException('FORBIDDEN');

    // 이미 처리된 챌린지 - 브루트포스 방지: 맞음/틀림 미노출
    if (challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) return;

    if (challenge.correctNum === selectedNumber) {
      await this.twoFaRepository.updateStatus(challengeId, 'APPROVED', new Date());
    } else {
      await this.twoFaRepository.updateStatus(challengeId, 'DENIED', new Date());
    }
  }

  @LogReplay()
  async claimApprovedChallenge(challengeId: string): Promise<string> {
    const challenge = await this.twoFaRepository.findById(challengeId);
    if (!challenge || challenge.status !== 'APPROVED') throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    await this.twoFaRepository.updateStatus(challengeId, 'EXPIRED');
    return challenge.userId;
  }

  @LogReplay()
  async resend(oldChallengeId: string): Promise<ResendChallengeResponseDto> {
    const old = await this.twoFaRepository.findById(oldChallengeId);
    if (!old) throw new ApiException('TWO_FA_CHALLENGE_NOT_FOUND');
    if (old.status === 'PENDING') {
      await this.twoFaRepository.updateStatus(oldChallengeId, 'EXPIRED');
    }
    const challenge = await this.createChallenge(old.userId);
    return { challengeId: challenge.id, options: challenge.options.split(','), expiresAt: challenge.expiresAt };
  }

  private generateOptions(): number[] {
    const nums = new Set<number>();
    while (nums.size < 3) {
      nums.add(10 + randomInt(90));
    }
    return [...nums];
  }
}

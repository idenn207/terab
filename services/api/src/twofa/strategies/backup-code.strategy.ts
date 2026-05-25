import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { BackupCodeService } from '../backup-code/backup-code.service';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface BackupCodeResponsePayload {
  code: string;
}

@Injectable()
export class BackupCodeTwoFaStrategy implements TwoFaStrategy<never, never, BackupCodeResponsePayload> {
  readonly type: TwoFaStrategyType = 'BACKUP_CODE';

  constructor(private readonly backupCodeService: BackupCodeService) {}

  async startSetup(_userId: string): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(_userId: string, _payload: unknown): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(_userId: string): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(userId: string, _challengeId: string, payload: BackupCodeResponsePayload): Promise<boolean> {
    await this.backupCodeService.consume(userId, payload.code);
    return true;
  }

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const unused = await this.backupCodeService.list(userId);
    if (unused.length === 0) return [];
    return [{ id: 'backup-code', createdAt: unused[0].createdAt, lastUsedAt: null }];
  }

  async revoke(_userId: string, _id: string): Promise<void> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }
}

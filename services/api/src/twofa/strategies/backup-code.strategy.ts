import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { BackupCodeService } from '../backup-code.service';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface BackupCodeResponsePayload {
  code: string;
}

@Injectable()
export class BackupCodeTwoFaStrategy implements TwoFaStrategy<never, never, BackupCodeResponsePayload> {
  readonly type: TwoFaStrategyType = 'BACKUP_CODE';

  constructor(private readonly backupCodeService: BackupCodeService) {}

  async startSetup(_userId: string): Promise<never> {
    throw new ApiException('TWO_FA_SETUP_NOT_SUPPORTED');
  }

  async completeSetup(_userId: string, _payload: unknown): Promise<void> {
    throw new ApiException('TWO_FA_SETUP_NOT_SUPPORTED');
  }

  async createChallenge(_userId: string): Promise<never> {
    throw new ApiException('TWO_FA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(userId: string, _challengeId: string, payload: BackupCodeResponsePayload): Promise<boolean> {
    await this.backupCodeService.consume(userId, payload.code);
    return true;
  }

  async list(_userId: string): Promise<TwoFaStrategyInstance[]> {
    throw new ApiException('TWO_FA_SETUP_NOT_SUPPORTED');
  }

  async revoke(_userId: string, _id: string): Promise<void> {
    throw new ApiException('TWO_FA_SETUP_NOT_SUPPORTED');
  }
}

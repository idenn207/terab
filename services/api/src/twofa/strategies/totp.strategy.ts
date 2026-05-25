import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { TotpLockoutService } from '../totp-lockout.service';
import { TotpService } from '../totp.service';
import { TwoFaStrategy, TwoFaStrategyInstance, TwoFaStrategyType } from './twofa-strategy.interface';

interface TotpSetupPayload {
  secret: string;
  code: string;
}

interface TotpResponsePayload {
  code: string;
}

@Injectable()
export class TotpTwoFaStrategy implements TwoFaStrategy<unknown, never, TotpResponsePayload> {
  readonly type: TwoFaStrategyType = 'TOTP';

  constructor(
    private readonly totpService: TotpService,
    private readonly lockout: TotpLockoutService,
  ) {}

  async startSetup(userId: string) {
    return this.totpService.startSetup(userId);
  }

  async completeSetup(userId: string, payload: unknown): Promise<void> {
    const body = payload as Partial<TotpSetupPayload>;
    if (typeof body?.secret !== 'string' || typeof body?.code !== 'string') {
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    await this.totpService.completeSetup(userId, body.secret, body.code);
  }

  async createChallenge(_userId: string): Promise<never> {
    throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');
  }

  async verifyResponse(userId: string, _challengeId: string, payload: TotpResponsePayload): Promise<boolean> {
    if (await this.lockout.isLocked(userId)) {
      throw new ApiException('TWOFA_TOTP_LOCKED');
    }
    const ok = await this.totpService.verifyCode(userId, payload.code);
    if (!ok) {
      await this.lockout.recordFailure(userId);
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    await this.lockout.clearLockout(userId);
    return true;
  }

  async list(userId: string): Promise<TwoFaStrategyInstance[]> {
    const row = await this.totpService.list(userId);
    if (!row) return [];
    return [{ id: row.id, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt }];
  }

  async revoke(userId: string, id: string): Promise<void> {
    const ok = await this.totpService.revoke(id, userId);
    if (!ok) throw new ApiException('FORBIDDEN');
  }
}

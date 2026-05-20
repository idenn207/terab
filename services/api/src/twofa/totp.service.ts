import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { EncryptionService } from '@terab/security';
import { createGuardrails, OTP } from 'otplib';
import { TotpRepository } from './totp.repository';

interface SetupPendingResult {
  status: 'PENDING';
  secret: string;
  otpauthUri: string;
}

interface SetupEnrolledResult {
  status: 'ENROLLED';
  id: string;
}

export type SetupStartResult = SetupPendingResult | SetupEnrolledResult;

@Injectable()
export class TotpService extends ServiceCore {
  private readonly ISSUER = 'terab';
  private readonly WINDOW = 1;
  private readonly otp: OTP;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly totpRepository: TotpRepository,
    private readonly encryption: EncryptionService,
  ) {
    super(database, txContext);
    this.otp = new OTP({ strategy: 'totp', guardrails: createGuardrails({ MAX_WINDOW: this.WINDOW }) });
  }

  async startSetup(userId: string): Promise<SetupStartResult> {
    const existing = await this.totpRepository.findByUserId(userId);
    if (existing) return { status: 'ENROLLED', id: existing.id };

    const secret = this.otp.generateSecret();
    const otpauthUri = this.otp.generateURI({ label: userId, issuer: this.ISSUER, secret });
    return { status: 'PENDING', secret, otpauthUri };
  }

  async completeSetup(userId: string, secret: string, code: string): Promise<{ id: string }> {
    const existing = await this.totpRepository.findByUserId(userId);
    if (existing) throw new ApiException('TWOFA_SETUP_NOT_SUPPORTED');

    if (!this.otp.verifySync({ token: code, secret }).valid) {
      throw new ApiException('TWOFA_TOTP_INVALID_CODE');
    }
    const enc = this.encryption.encrypt(secret);
    const row = await this.totpRepository.insert({
      userId,
      secretEncrypted: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
    });
    return { id: row.id };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const row = await this.totpRepository.findByUserId(userId);
    if (!row) return false;

    const secret = this.encryption.decrypt({
      ciphertext: row.secretEncrypted,
      iv: row.iv,
      authTag: row.authTag,
    });
    const ok = this.otp.verifySync({ token: code, secret }).valid;
    if (ok) {
      await this.totpRepository.updateLastUsedAt(row.id, new Date());
    }
    return ok;
  }
}

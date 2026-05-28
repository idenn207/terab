import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import { SessionRepository } from './session.repository';

export interface IssuedRefreshToken {
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

@Injectable()
export class SessionService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly tokenService: TokenService,
    private readonly sessionRepository: SessionRepository,
  ) {
    super(database, txContext);
  }

  async issueForUser(userId: string): Promise<IssuedRefreshToken> {
    const { rawRefreshToken, tokenHash, expiresAt } = this.tokenService.issueRefreshToken();
    await this.sessionRepository.insert({ userId, tokenHash, expiresAt });
    return {
      rawRefreshToken,
      refreshTokenExpMs: this.tokenService.refreshExpMs,
    };
  }

  async rotate(rawRefreshToken: string): Promise<RotatedRefreshToken> {
    return this.runInTx(async () => {
      const now = new Date();
      const tokenHash = this.tokenService.hashToken(rawRefreshToken);
      const matched = await this.sessionRepository.findActiveByHash(tokenHash, now);
      if (!matched) throw new ApiException('REFRESH_TOKEN_INVALID');

      await this.sessionRepository.revokeById(matched.id, now);
      const issued = await this.issueForUser(matched.userId);

      return { userId: matched.userId, ...issued };
    });
  }

  async revokeByRawToken(rawRefreshToken: string): Promise<{ userId?: string }> {
    const now = new Date();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const matched = await this.sessionRepository.findActiveByHash(tokenHash, now);
    if (matched) {
      await this.sessionRepository.revokeById(matched.id, now);
      return { userId: matched.userId };
    }
    return {};
  }
}

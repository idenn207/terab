import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AutoTrace } from '@terab/logger';
import crypto from 'node:crypto';

@Injectable()
@AutoTrace()
export class TokenService {
  readonly accessExpMs: number;
  readonly refreshExpMs: number;
  private readonly pepper: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessExpMs = Number(this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRY_MS'));
    this.refreshExpMs = Number(this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY_MS'));
    this.pepper = this.configService.getOrThrow<string>('PASSWORD_PEPPER');
  }

  generateAccessToken(userId: string, username: string, permissions: string[]): string {
    return this.jwtService.sign(
      { sub: userId, username: username, permissions: permissions },
      { expiresIn: Math.floor(this.accessExpMs / 1000) },
    );
  }

  issueRefreshToken() {
    const rawRefreshToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpMs);
    return { rawRefreshToken, tokenHash, expiresAt };
  }

  // ─── 암호화 유틸 ─────────────────────────────────────────────────────
  pepperPassword(rawPassword: string): string {
    return crypto.createHmac('sha256', this.pepper).update(rawPassword).digest('hex');
  }

  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}

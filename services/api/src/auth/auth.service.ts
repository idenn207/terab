import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Select } from '@terab/db';
import { TokenService } from '@terab/security';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { UserService } from '../user/user.service';
import { LoginResponse } from './dto';
import { RoleService } from './role/role.service';
import { SessionService } from './session/session.service';

@Injectable()
export class AuthService extends ServiceCore {
  protected readonly BCRYPT_ROUNDS = 10;
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly TRUST_TOKEN_COOKIE = 'trustToken';
  private readonly COOKIE_PATH = '/';

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly roleService: RoleService,
    private readonly userService: UserService,
  ) {
    super(database, txContext);
  }

  // ─── 사용자 정보 로직 ────────────────────────────────────────────────
  async hashPassword(raw: string): Promise<string> {
    const peppered = this.tokenService.pepperPassword(raw);
    return bcrypt.hash(peppered, this.BCRYPT_ROUNDS);
  }

  async assignDefaultRole(userId: string): Promise<void> {
    const role = await this.roleService.findByName('USER');
    if (!role) throw new ApiException('ROLE_NOT_FOUND');
    await this.roleService.assignUserRole(userId, role.id);
  }

  async validateCredentials(user: Pick<Users$Select, 'password' | 'active'>, rawPassword: string): Promise<void> {
    const pepperedPassword = this.tokenService.pepperPassword(rawPassword);
    const valid = await bcrypt.compare(pepperedPassword, user.password);
    if (!valid) throw new ApiException('INVALID_CREDENTIALS');
    if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
  }

  // ─── 인증 토큰 로직 ──────────────────────────────────────────────────
  async generateAccessToken(user: Users$Select): Promise<string> {
    const permissions = await this.roleService.getPermissionsByUserId(user.id);
    return this.tokenService.generateAccessToken(user.id, user.username, permissions);
  }

  async issueTokenPair(user: Users$Select, res: Response): Promise<{ accessToken: string }> {
    const accessToken = await this.generateAccessToken(user);
    const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(user.id);
    this.setRefreshCookie(res, rawRefreshToken, refreshTokenExpMs);
    return { accessToken };
  }

  async rotateRefreshToken(rawRt: string | undefined, res: Response): Promise<{ userId: string }> {
    if (!rawRt) throw new ApiException('REFRESH_TOKEN_INVALID');
    const rotated = await this.sessionService.rotate(rawRt);
    this.setRefreshCookie(res, rotated.rawRefreshToken, rotated.refreshTokenExpMs);
    return { userId: rotated.userId };
  }

  async revokeRefreshToken(rawRt: string | undefined, res: Response): Promise<void> {
    if (rawRt) {
      await this.sessionService.revokeByRawToken(rawRt);
    }
    this.clearRefreshCookie(res);
  }

  // ─── 2FA ──────────────────────────────────────────────────────────
  async issueAfterTwoFa(userId: string, res: Response): Promise<LoginResponse> {
    const user = await this.userService.findById(userId);
    if (!user) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
    const { accessToken } = await this.issueTokenPair(user, res);
    return {
      status: 'AUTHENTICATED',
      accessToken,
      user: { id: user.id, username: user.username, nickname: user.nickname },
    };
  }

  // ─── Cookie 설정 ──────────────────────────────────────────────────
  setTrustCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: this.COOKIE_PATH,
    });
  }

  clearTrustCookie(res: Response): void {
    res.clearCookie(this.TRUST_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.COOKIE_PATH,
    });
  }

  private setRefreshCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(this.REFRESH_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: this.COOKIE_PATH,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.COOKIE_PATH,
    });
  }

  // // ─── 사용자+권한 합성 ────────────────────────────────────────────────
  // async findUserWithPermissions(user: Users$Select): Promise<UserWithPermissions> {
  //   const permissions = await this.roleService.getPermissionsByUserId(user.id);
  //   return {
  //     id: user.id,
  //     username: user.username,
  //     nickname: user.nickname,
  //     password: user.password,
  //     active: user.active,
  //     permissions,
  //   };
  // }
}

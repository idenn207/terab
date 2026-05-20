import { Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Select } from '@terab/db';
import { TokenService } from '@terab/security';
import bcrypt from 'bcryptjs';
import { RoleService } from './role/role.service';
import { SessionService } from './session/session.service';
import { UserWithPermissions } from './types/user-with-permissions.type';

interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

@Injectable()
export class AuthService extends ServiceCore {
  protected readonly BCRYPT_ROUNDS = 10;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly roleService: RoleService,
  ) {
    super(database, txContext);
  }

  // ─── 사용자+권한 합성 ────────────────────────────────────────────────
  async findUserWithPermissions(user: Users$Select): Promise<UserWithPermissions> {
    const permissions = await this.roleService.getPermissionsByUserId(user.id);
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      password: user.password,
      active: user.active,
      permissions,
    };
  }

  // ─── 내부 인증 로직 ──────────────────────────────────────────────────
  private async validateCredentials(user: UserWithPermissions, rawPassword: string): Promise<void> {
    const pepperedPassword = this.tokenService.pepperPassword(rawPassword);
    const valid = await bcrypt.compare(pepperedPassword, user.password);
    if (!valid) throw new ApiException('INVALID_CREDENTIALS');
    if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
  }

  // ─── 내부 비즈니스 로직 ──────────────────────────────────────────────

  async issueTokenPair(user: UserWithPermissions): Promise<AuthTokens> {
    const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
    const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(user.id);
    return {
      accessToken,
      rawRefreshToken,
      refreshTokenExpMs,
    };
  }
}

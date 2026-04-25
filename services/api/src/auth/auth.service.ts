import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiException } from '@terab/common';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AuthRepository, UserWithPermissions } from './auth.repository.js';
import { BackupLoginDto } from './dto/backup-login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

const BCRYPT_ROUNDS = 10;

interface AuthTokens {
  accessToken: string;
  rawRefreshToken: string;
  refreshTokenExpMs: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly accessExpMs: number;
  private readonly refreshExpMs: number;
  private readonly pepper: string;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessExpMs = Number(this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRY_MS'));
    this.refreshExpMs = Number(this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY_MS'));
    this.pepper = this.configService.getOrThrow<string>('PASSWORD_PEPPER');
  }

  async onModuleInit(): Promise<void> {
    await this.initOwnerAccount();
  }

  // ─── Login ───────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{
    response: LoginResponseDto;
    rawRefreshToken: string;
    refreshTokenExpMs: number;
  }> {
    const user = await this.authRepository.findUserWithPermissionsByUsername(dto.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, dto.password);

    // Push 기기 존재 시 2FA 챌린지 발급 (device, twofa 도메인 구현 후 추가)
    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return {
      response,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  async loginWithBackupCode(dto: BackupLoginDto): Promise<{
    response: LoginResponseDto;
    rawRefreshToken: string;
    refreshTokenExpMs: number;
  }> {
    const user = await this.authRepository.findUserWithPermissionsByUsername(dto.username);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    await this.validateCredentials(user, dto.password);
    await this.verifyAndConsumeBackupCode(user.id, dto.backupCode);

    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return {
      response,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  // ─── Refresh ─────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string | undefined): Promise<{
    response: LoginResponseDto;
    rawRefreshToken: string;
    refreshTokenExpMs: number;
  }> {
    if (!rawRefreshToken) throw new ApiException('REFRESH_TOKEN_INVALID');

    const now = new Date();
    const tokenHash = this.hashToken(rawRefreshToken);
    // UUID 기반 토큰은 userId 클레임이 없으므로 family invalidation 불가
    // TODO: RT를 JWT로 변경하면 subject에서 userId 추출 후 전체 폐기 가능
    const matched = await this.authRepository.findActiveRefreshTokenByHash(tokenHash, now);

    if (!matched) {
      throw new ApiException('REFRESH_TOKEN_INVALID');
    }

    await this.authRepository.revokeRefreshTokenById(matched.id, now);

    const user = await this.authRepository.findUserWithPermissionsById(matched.userId);
    if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');

    const tokens = await this.issueTokenPair(user);
    const response = LoginResponseDto.authenticated(
      tokens.accessToken,
      new UserResponseDto(user.id, user.username, user.nickname),
    );
    return {
      response,
      rawRefreshToken: tokens.rawRefreshToken,
      refreshTokenExpMs: tokens.refreshTokenExpMs,
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const now = new Date();
    const tokenHash = this.hashToken(rawRefreshToken);
    const matched = await this.authRepository.findActiveRefreshTokenByHash(tokenHash, now);
    if (matched) {
      await this.authRepository.revokeRefreshTokenById(matched.id, now);
    }
  }

  // ─── Me ──────────────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.authRepository.findUserWithPermissionsById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    return new UserResponseDto(user.id, user.username, user.nickname);
  }

  // ─── 내부 인증 로직 ──────────────────────────────────────────────────

  private async validateCredentials(user: UserWithPermissions, rawPassword: string): Promise<void> {
    const pepperedPassword = this.pepperPassword(rawPassword);
    const valid = await bcrypt.compare(pepperedPassword, user.password);
    if (!valid) throw new ApiException('INVALID_CREDENTIALS');
    if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
  }

  private generateAccessToken(user: Pick<UserWithPermissions, 'id' | 'username' | 'permissions'>): string {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, permissions: user.permissions },
      { expiresIn: Math.floor(this.accessExpMs / 1000) },
    );
  }

  // ─── 내부 비즈니스 로직 ──────────────────────────────────────────────

  private async issueTokenPair(user: UserWithPermissions): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(user);
    const rawRefreshToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpMs);
    await this.authRepository.insertRefreshToken(user.id, tokenHash, expiresAt);
    return {
      accessToken,
      rawRefreshToken,
      refreshTokenExpMs: this.refreshExpMs,
    };
  }

  private async verifyAndConsumeBackupCode(userId: string, inputCode: string): Promise<void> {
    const codes = await this.authRepository.findUnusedBackupCodes(userId);
    // 타이밍 오라클 방지 — 매칭 여부와 무관하게 모든 코드를 순회
    let matchedId: string | null = null;
    for (const code of codes) {
      const match = await bcrypt.compare(inputCode, code.codeHash);
      if (match && matchedId === null) {
        matchedId = code.id;
      }
    }
    if (matchedId === null) throw new ApiException('BACKUP_CODE_INVALID');
    await this.authRepository.markBackupCodeUsed(matchedId, new Date());
  }

  // ─── Owner 계정 초기화 ───────────────────────────────────────────────

  private async initOwnerAccount(): Promise<void> {
    const ownerPassword = this.configService.get<string>('OWNER_PASSWORD');
    if (!ownerPassword) return;

    const ownerUsername = this.configService.get<string>('OWNER_USERNAME') ?? 'owner';
    const ownerNickname = this.configService.get<string>('OWNER_NICKNAME') ?? 'Owner';

    const existing = await this.authRepository.findUserByUsername(ownerUsername);
    if (existing) return;

    const ownerRole = await this.authRepository.findRoleByName('OWNER');
    if (!ownerRole) throw new Error('OWNER role 없음 — 마이그레이션 실행 여부를 확인하세요');

    const hashedPassword = await bcrypt.hash(this.pepperPassword(ownerPassword), BCRYPT_ROUNDS);
    try {
      const newUser = await this.authRepository.insertUser({
        username: ownerUsername,
        nickname: ownerNickname,
        password: hashedPassword,
      });
      await this.authRepository.insertUserRole(newUser.id, ownerRole.id);
    } catch (err) {
      if ((err as { code?: string }).code !== '23505') throw err;
      // 동시 기동 시 UNIQUE 충돌 무시 (다른 인스턴스가 먼저 생성)
    }
  }

  // ─── 암호화 유틸 ─────────────────────────────────────────────────────

  private pepperPassword(rawPassword: string): string {
    return crypto.createHmac('sha256', this.pepper).update(rawPassword).digest('hex');
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}

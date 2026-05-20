import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, Cookies, CurrentUser, Public, type AuthUser } from '@terab/common';
import type { Request, Response } from 'express';
import { UserDto } from '../common/dto';
import { AuthService } from './auth.service';
import {
  AuthenticatedResponseDto,
  BackupCodeRegenerateBodyDto,
  BackupCodeRegenerateResponseDto,
  BackupLoginBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  RegisterResponseDto,
  TwoFaRequiredResponseDto,
  type LoginResponse,
} from './dto';

const LOGIN_RESPONSE_API_RESPONSE = {
  status: HttpStatus.OK,
  schema: {
    oneOf: refs(AuthenticatedResponseDto, TwoFaRequiredResponseDto),
    discriminator: {
      propertyName: 'status',
      mapping: {
        'AUTHENTICATED': getSchemaPath(AuthenticatedResponseDto),
        '2FA_REQUIRED': getSchemaPath(TwoFaRequiredResponseDto),
      },
    },
  },
} as const;

@Controller('auth')
@ApiTags('Auth')
@ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
export class AuthController {
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly COOKIE_PATH = '/';

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 — 초대 토큰 소비 후 RT 쿠키 설정' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RegisterResponseDto })
  @ApiError(
    'INVITATION_NOT_FOUND',
    'INVITATION_EXPIRED',
    'INVITATION_ALREADY_USED',
    'USERNAME_TAKEN',
    'REGISTRATION_FAILED',
    'ROLE_NOT_FOUND',
  )
  async register(
    @Body() body: RegisterBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterResponseDto> {
    const { accessToken, user, backupCodes, rawRefreshToken, refreshTokenExpMs } =
      await this.authService.register(body);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return { accessToken, user, backupCodes };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 — 2FA 필요 시 챌린지 발급, 아니면 AUTHENTICATED + RT 쿠키' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'ACCOUNT_DISABLED')
  async login(
    @Body() body: LoginBodyDto,
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(body, trustToken, userAgent);
    if (rawRefreshToken && refreshTokenExpMs) {
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    }
    return response;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/backup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '백업 코드 로그인 — 2FA 우회' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'BACKUP_CODE_INVALID', 'ACCOUNT_DISABLED')
  async loginWithBackup(
    @Body() body: BackupLoginBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.loginWithBackupCode(body);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('2fa/challenge/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 완료 — APPROVED 상태에서 토큰 발급' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND')
  async completeTwoFa(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.completeTwoFa(id);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh Token 회전' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('REFRESH_TOKEN_INVALID')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
    this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃 — RT 폐기 및 쿠키 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(rawRefreshToken);
    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.COOKIE_PATH,
    });
  }

  @Get('me')
  @ApiOperation({ summary: '현재 사용자 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiError('INVALID_CREDENTIALS')
  async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.getCurrentUser(user.userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backup Code 재발급 — 기존 unused 폐기 후 8개 신규 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: BackupCodeRegenerateResponseDto })
  @ApiError('INVALID_CREDENTIALS')
  async regenerateBackupCodes(
    @CurrentUser() user: AuthUser,
    @Body() body: BackupCodeRegenerateBodyDto,
  ): Promise<BackupCodeRegenerateResponseDto> {
    const backupCodes = await this.authService.regenerateBackupCodes(user.userId, body.currentPassword);
    return { backupCodes };
  }

  private setRefreshTokenCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(this.REFRESH_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: this.COOKIE_PATH,
    });
  }
}

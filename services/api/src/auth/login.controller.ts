// import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
// import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
// import { Throttle } from '@nestjs/throttler';
// import { ApiError, Cookies, CurrentUser, Public, type AuthUser } from '@terab/common';
import type { Request, Response } from 'express';
// import { UserDto } from '../common/dto';
// import {
//   AuthenticatedResponseDto,
//   BackupCodeRegenerateBodyDto,
//   BackupCodeRegenerateResponseDto,
//   BackupLoginBodyDto,
//   LoginBodyDto,
//   RegisterBodyDto,
//   RegisterResponseDto,
//   TwoFaRequiredResponseDto,
//   type LoginResponse,
// } from './dto';
// import { LoginService } from './login.service';

import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, Cookies, Public } from '@terab/common';
import {
  AuthenticatedResponseDto,
  BackupLoginBodyDto,
  LoginBodyDto,
  LoginResponse,
  RegisterBodyDto,
  RegisterResponseDto,
  TwoFaRequiredResponseDto,
} from './dto';
import { LoginService } from './login.service';

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
export class LoginController {
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';

  constructor(private readonly loginService: LoginService) {}

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
    return this.loginService.register(body, res);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 — 2FA 필요 시 챌린지, 아니면 AUTHENTICATED' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'ACCOUNT_DISABLED')
  async login(
    @Body() body: LoginBodyDto,
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.loginService.login(body, trustToken, userAgent, res);
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
    return this.loginService.loginWithBackupCode(body, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh Token 회전' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('REFRESH_TOKEN_INVALID')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const rawRt = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    return this.loginService.refresh(rawRt, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃 — RT 폐기 및 쿠키 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawRt = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.loginService.logout(rawRt, res);
  }
}

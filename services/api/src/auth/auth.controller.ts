import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { BackupLoginDto } from './dto/backup-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { AuthUser } from './types/auth-user.type';

@Controller('api/auth')
export class AuthController {
  protected REFRESH_TOKEN_COOKIE = 'refreshToken';
  protected COOKIE_PATH = '/api/auth';
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/backup')
  @HttpCode(HttpStatus.OK)
  async loginWithBackup(
    @Body() dto: BackupLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.loginWithBackupCode(dto);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
    this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
    return response;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(user.userId);
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

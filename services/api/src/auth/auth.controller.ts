import { Controller, Headers, HttpStatus, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Cookies } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type { AuthUser } from './types/auth-user.type';

@Controller()
export class AuthController {
  protected REFRESH_TOKEN_COOKIE = 'refreshToken';
  protected COOKIE_PATH = '/';
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @TsRestHandler(contract.auth.register)
  handleRegister(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.register, async ({ body }) => {
      const { accessToken, user, backupCodes, rawRefreshToken, refreshTokenExpMs } =
        await this.authService.register(body);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: HttpStatus.CREATED, body: { accessToken, user, backupCodes } };
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @TsRestHandler(contract.auth.login)
  handleLogin(
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return tsRestHandler(contract.auth.login, async ({ body }) => {
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(
        body,
        trustToken,
        userAgent,
      );
      if (rawRefreshToken && refreshTokenExpMs) {
        this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      }
      return { status: HttpStatus.OK, body: response };
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @TsRestHandler(contract.auth.loginWithBackup)
  handleLoginWithBackup(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.loginWithBackup, async ({ body }) => {
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.loginWithBackupCode(body);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: HttpStatus.OK, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.completeTwoFa)
  handleCompleteTwoFa(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.completeTwoFa, async ({ params }) => {
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.completeTwoFa(params.id);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: HttpStatus.OK, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.refresh)
  handleRefresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.refresh, async () => {
      const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
      const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
      this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
      return { status: HttpStatus.OK, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.logout)
  handleLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.logout, async () => {
      const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
      await this.authService.logout(rawRefreshToken);
      res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: this.COOKIE_PATH,
      });
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.auth.me)
  handleMe(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.auth.me, async () => {
      const result = await this.authService.getCurrentUser(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
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

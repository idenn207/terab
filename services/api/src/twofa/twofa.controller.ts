import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { CurrentUser, Public } from '@terab/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { ChallengeStatusResponseDto } from './dto/challenge-status-response.dto';
import { RespondChallengeDto } from './dto/respond-challenge.dto';
import { TwoFaService } from './twofa.service';

@Controller('api/auth/2fa')
export class TwoFaController {
  private TRUST_TOKEN_COOKIE = 'trustToken';
  private COOKIE_PATH = '/api/auth/2fa';
  constructor(
    private readonly twoFaService: TwoFaService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  @Public()
  @Get('challenge/:id/status')
  async getStatus(@Param('id') id: string): Promise<ChallengeStatusResponseDto> {
    return this.twoFaService.getStatus(id);
  }

  @Post('challenge/:id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondChallengeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.twoFaService.respond(id, user.userId, dto.selectedNumber, dto.trustDevice ?? false);

    if (dto.trustDevice) {
      const rawToken = await this.trustedDeviceService.register(user.userId, req.headers['user-agent']);
      this.setTrustTokenCookie(res, rawToken, this.trustedDeviceService.trustDurationMs);
    }
  }

  @Public()
  @Post('challenge/:id/resend')
  async resend(@Param('id') id: string): Promise<{ challengeId: string; options: string[]; expiresAt: Date }> {
    const result = await this.twoFaService.resend(id);
    return { challengeId: result.id, options: result.options, expiresAt: result.expiresAt };
  }

  private setTrustTokenCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: this.COOKIE_PATH,
    });
  }
}

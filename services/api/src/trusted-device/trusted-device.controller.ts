import { Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceResponseDto } from './dto/trusted-device-response.dto';
import { TrustedDeviceService } from './trusted-device.service';

@Controller('api/trusted-device')
export class TrustedDeviceController {
  private readonly TRUST_TOKEN_COOKIE = 'trustToken';
  private readonly COOKIE_PATH = '/api/auth';

  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.findAll(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
    res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: this.trustedDeviceService.trustDurationMs,
      path: this.COOKIE_PATH,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.trustedDeviceService.revoke(id, user.userId);
  }
}

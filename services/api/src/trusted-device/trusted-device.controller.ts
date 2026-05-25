import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { TrustedDeviceResponseDto } from './dto';
import { TrustedDeviceService } from './trusted-device.service';

@Controller('trusted-device')
@ApiTags('TrustedDevice')
export class TrustedDeviceController {
  constructor(
    private readonly trustedDeviceService: TrustedDeviceService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: '신뢰기기 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: TrustedDeviceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: '신뢰기기 등록 — trustToken 쿠키를 설정한다' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async register(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
    this.authService.setTrustCookie(res, rawToken, this.trustedDeviceService.trustDurationMs);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '신뢰기기 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TRUSTED_DEVICE_NOT_FOUND')
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.trustedDeviceService.revoke(id, user.userId);
  }
}

import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceResponseDto } from './dto/trusted-device-response.dto';
import { TrustedDeviceService } from './trusted-device.service';

@Controller('api/trusted-device')
export class TrustedDeviceController {
  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.trustedDeviceService.revoke(id, user.userId);
  }
}

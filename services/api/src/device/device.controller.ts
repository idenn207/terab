import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { DeviceService } from './device.service';
import { DeviceResponseDto } from './dto/device-response.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('api/devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.deviceService.register(user.userId, dto.pushToken, userAgent);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<DeviceResponseDto[]> {
    return this.deviceService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.deviceService.remove(id, user.userId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { DeviceResponseDto, RegisterDeviceBodyDto } from './dto';
import { DeviceService } from './device.service';

@Controller('devices')
@ApiTags('Device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @ApiOperation({ summary: '디바이스 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: DeviceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<DeviceResponseDto[]> {
    return this.deviceService.list(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '디바이스 등록' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async register(
    @CurrentUser() user: AuthUser,
    @Body() body: RegisterDeviceBodyDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<void> {
    await this.deviceService.register(user.userId, body.pushToken, userAgent);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '디바이스 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('DEVICE_NOT_FOUND')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deviceService.remove(id, user.userId);
  }
}

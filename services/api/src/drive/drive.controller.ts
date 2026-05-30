import { Controller, Get, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, CurrentUser, type AuthUser } from '@terab/common';
import { DriveDto, toDriveDto } from './dto/drive.dto';
import { DriveService } from './drive.service';

@Controller('drives')
@ApiTags('Drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('me')
  @ApiOperation({ summary: '본인 personal drive 조회 — 없으면 lazy 생성' })
  @ApiResponse({ status: HttpStatus.OK, type: DriveDto })
  async getMyDrive(@CurrentUser() user: AuthUser): Promise<DriveDto> {
    const drive = await this.driveService.ensurePersonalDrive(user.userId);
    return toDriveDto(drive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'drive 단건 조회 — 본인 소유만 접근 가능' })
  @ApiResponse({ status: HttpStatus.OK, type: DriveDto })
  @ApiError('DRIVE_NOT_FOUND', 'DRIVE_FORBIDDEN')
  async getDrive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DriveDto> {
    const drive = await this.driveService.findByIdOrThrow(id, user.userId);
    return toDriveDto(drive);
  }
}

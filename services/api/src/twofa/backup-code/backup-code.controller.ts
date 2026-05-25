import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { BackupCodeService } from './backup-code.service';
import { BackupCodeRegenerateBodyDto, BackupCodeRegenerateResponseDto } from './dto';

@Controller('backup-codes')
@ApiTags('TwoFa')
export class BackupCodeController {
  constructor(private readonly backupCodeService: BackupCodeService) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backup Code 재발급 — 기존 unused 폐기 후 신규 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: BackupCodeRegenerateResponseDto })
  @ApiError('INVALID_CREDENTIALS')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() body: BackupCodeRegenerateBodyDto,
  ): Promise<BackupCodeRegenerateResponseDto> {
    const backupCodes = await this.backupCodeService.regenerateForUser(user.userId, body);
    return { backupCodes };
  }
}

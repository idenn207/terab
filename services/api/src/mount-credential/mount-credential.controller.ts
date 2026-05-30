import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { IssueMountCredentialDto } from './dto/issue-mount-credential.dto';
import { IssueMountCredentialResponseDto } from './dto/issue-mount-credential-response.dto';
import { MountCredentialDto } from './dto/mount-credential.dto';
import { MountCredentialService } from './mount-credential.service';

@Controller('mount-credentials')
@ApiTags('MountCredential')
export class MountCredentialController {
  constructor(private readonly service: MountCredentialService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '마운트 자격증명 발급 — password/script 는 1회만 응답' })
  @ApiResponse({ status: HttpStatus.CREATED, type: IssueMountCredentialResponseDto })
  @ApiError(
    'DRIVE_NOT_FOUND',
    'DRIVE_FORBIDDEN',
    'MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL',
    'MOUNT_CREDENTIAL_SECRET_WRITE_FAILED',
    'STORAGE_AGENT_UNAVAILABLE',
    'STORAGE_AGENT_TARGET_CONFLICT',
    'STORAGE_AGENT_INTERNAL',
  )
  async issue(
    @CurrentUser() user: AuthUser,
    @Body() body: IssueMountCredentialDto,
  ): Promise<IssueMountCredentialResponseDto> {
    return this.service.issue(user.userId, body.driveId);
  }

  @Get()
  @ApiOperation({ summary: '본인의 활성 마운트 자격증명 목록' })
  @ApiResponse({ status: HttpStatus.OK, type: MountCredentialDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<MountCredentialDto[]> {
    return this.service.listActive(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '마운트 자격증명 회수 — agent target 삭제 + secret 제거 + DB soft-revoke' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError(
    'MOUNT_CREDENTIAL_NOT_FOUND',
    'MOUNT_CREDENTIAL_REVOKED',
    'STORAGE_AGENT_UNAVAILABLE',
    'STORAGE_AGENT_INTERNAL',
  )
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.revoke(user.userId, id);
  }
}

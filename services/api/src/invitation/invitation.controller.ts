import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public, RequirePermission } from '@terab/common';
import { InvitationService } from './invitation.service';
import {
  CreateInvitationBodyDto,
  InvitationResponseDto,
  ValidateInvitationResponseDto,
} from './dto';

@Controller('invitations')
@ApiTags('Invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermission('user:invite')
  @Post()
  @ApiOperation({ summary: '초대장 생성' })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvitationResponseDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInvitationBodyDto,
  ): Promise<InvitationResponseDto> {
    return this.invitationService.create(user.userId, body.expiresInDays);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':token')
  @ApiOperation({ summary: '초대 토큰 유효성 검증' })
  @ApiResponse({ status: HttpStatus.OK, type: ValidateInvitationResponseDto })
  async validate(@Param('token', ParseUUIDPipe) token: string): Promise<ValidateInvitationResponseDto> {
    return this.invitationService.validate(token);
  }

  @RequirePermission('user:manage')
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '초대장 비활성화' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('INVITATION_NOT_FOUND')
  async deactivate(@Param('token', ParseUUIDPipe) token: string): Promise<void> {
    await this.invitationService.deactivate(token);
  }
}

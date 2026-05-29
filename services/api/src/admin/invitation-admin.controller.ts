import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, RequirePermission } from '@terab/common';
import { CreateInvitationBodyDto, InvitationResponseDto } from '../invitation/dto';
import { InvitationService } from '../invitation/invitation.service';

@Controller('admin/users/invitations')
@ApiTags('AdminInvitation')
export class InvitationAdminController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermission('user:invite')
  @Post()
  @ApiOperation({ summary: '관리자 — 사용자 초대 생성' })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvitationResponseDto })
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateInvitationBodyDto): Promise<InvitationResponseDto> {
    return this.invitationService.create(user.userId, body.expiresInDays);
  }
}

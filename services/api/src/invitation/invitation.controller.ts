import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, RequirePermission } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { InvitationService } from './invitation.service';

@Controller('api/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @RequirePermission('user:invite')
  async create(@Body() dto: CreateInvitationDto, @CurrentUser() user: AuthUser): Promise<InvitationResponseDto> {
    return this.invitationService.create(user.userId, dto.expiresInDays);
  }

  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':token')
  @Public()
  async validate(@Param('token') token: string): Promise<{ valid: boolean }> {
    const valid = await this.invitationService.validate(token);
    return { valid };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user:manage')
  async deactivate(@Param('token') token: string): Promise<void> {
    await this.invitationService.deactivate(token);
  }
}

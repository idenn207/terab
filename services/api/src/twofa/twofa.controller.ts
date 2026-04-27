import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser, Public } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { ChallengeStatusResponseDto } from './dto/challenge-status-response.dto';
import { RespondChallengeDto } from './dto/respond-challenge.dto';
import { TwoFaService } from './twofa.service';

@Controller('api/auth/2fa')
export class TwoFaController {
  constructor(private readonly twoFaService: TwoFaService) {}

  @Public()
  @Get('challenge/:id/status')
  async getStatus(@Param('id') id: string): Promise<ChallengeStatusResponseDto> {
    return this.twoFaService.getStatus(id);
  }

  @Post('challenge/:id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondChallengeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.twoFaService.respond(id, user.userId, dto.selectedNumber);
  }

  @Public()
  @Post('challenge/:id/resend')
  async resend(@Param('id') id: string): Promise<{ challengeId: string; options: string[]; expiresAt: Date }> {
    const result = await this.twoFaService.resend(id);
    return { challengeId: result.id, options: result.options, expiresAt: result.expiresAt };
  }
}

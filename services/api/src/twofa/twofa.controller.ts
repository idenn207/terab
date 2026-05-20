import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public } from '@terab/common';
import {
  ChallengeStatusApprovedDto,
  ChallengeStatusDeniedDto,
  ChallengeStatusExpiredDto,
  ChallengeStatusPendingDto,
  type ChallengeStatusResponse,
  ResendChallengeResponseDto,
  RespondChallengeBodyDto,
} from './dto';
import { TwoFaService } from './twofa.service';

@Controller('2fa/challenge')
@ApiTags('TwoFa')
export class TwoFaController {
  constructor(private readonly twoFaService: TwoFaService) {}

  @Public()
  @Get(':id/status')
  @ApiOperation({ summary: '2FA 챌린지 상태 조회' })
  @ApiExtraModels(
    ChallengeStatusPendingDto,
    ChallengeStatusApprovedDto,
    ChallengeStatusDeniedDto,
    ChallengeStatusExpiredDto,
  )
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      oneOf: refs(
        ChallengeStatusPendingDto,
        ChallengeStatusApprovedDto,
        ChallengeStatusDeniedDto,
        ChallengeStatusExpiredDto,
      ),
      discriminator: {
        propertyName: 'status',
        mapping: {
          PENDING: getSchemaPath(ChallengeStatusPendingDto),
          APPROVED: getSchemaPath(ChallengeStatusApprovedDto),
          DENIED: getSchemaPath(ChallengeStatusDeniedDto),
          EXPIRED: getSchemaPath(ChallengeStatusExpiredDto),
        },
      },
    },
  })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND')
  async getStatus(@Param('id', ParseUUIDPipe) id: string): Promise<ChallengeStatusResponse> {
    return this.twoFaService.getStatus(id);
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '2FA 챌린지 응답' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND', 'FORBIDDEN')
  async respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RespondChallengeBodyDto,
  ): Promise<void> {
    await this.twoFaService.respond(id, user.userId, body.selectedNumber);
  }

  @Public()
  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 재발송' })
  @ApiResponse({ status: HttpStatus.OK, type: ResendChallengeResponseDto })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND')
  async resend(@Param('id', ParseUUIDPipe) id: string): Promise<ResendChallengeResponseDto> {
    return this.twoFaService.resend(id);
  }
}

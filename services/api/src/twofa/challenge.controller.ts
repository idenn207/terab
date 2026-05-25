import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public } from '@terab/common';
import type { Response } from 'express';
import { AuthenticatedResponseDto, LoginResponse } from '../auth/dto';
import {
  ChallengeStatusApprovedDto,
  ChallengeStatusDeniedDto,
  ChallengeStatusExpiredDto,
  ChallengeStatusPendingDto,
  type ChallengeStatusResponse,
  CompleteChallengeBodyDto,
  ResendChallengeResponseDto,
  RespondChallengeBodyDto,
} from './dto';
import { TwoFaService } from './twofa.service';

@Controller('2fa/challenge')
@ApiTags('TwoFa')
export class ChallengeController {
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
  @ApiOperation({ summary: '2FA 챌린지 응답 (PUSH 전용)' })
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
  @ApiOperation({ summary: '2FA 챌린지 재발송 (PUSH 전용)' })
  @ApiResponse({ status: HttpStatus.OK, type: ResendChallengeResponseDto })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND')
  async resend(@Param('id', ParseUUIDPipe) id: string): Promise<ResendChallengeResponseDto> {
    return this.twoFaService.resend(id);
  }

  @Public()
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 완료 — type별 verify 후 토큰 발급' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuthenticatedResponseDto,
  })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND', 'TWOFA_TOTP_INVALID_CODE', 'TWOFA_TOTP_LOCKED')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteChallengeBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const userId = await this.twoFaService.completeChallenge(id, body);
    return this.twoFaService.issueAuthenticatedResponse(userId, res);
  }
}

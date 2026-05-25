import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, CurrentUser, type AuthUser } from '@terab/common';
import {
  TotpListResponseDto,
  TotpSetupCompleteBodyDto,
  TotpSetupEnrolledDto,
  TotpSetupPendingDto,
  type TotpSetupStartResponse,
} from './dto';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TwoFaService } from './twofa.service';

@Controller('2fa/totp')
@ApiTags('TwoFa')
@ApiExtraModels(TotpSetupPendingDto, TotpSetupEnrolledDto)
export class TotpController {
  constructor(
    private readonly totpStrategy: TotpTwoFaStrategy,
    private readonly twoFaService: TwoFaService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'TOTP 등록 시작 — secret + otpauth URI 발급' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      oneOf: refs(TotpSetupPendingDto, TotpSetupEnrolledDto),
      discriminator: {
        propertyName: 'status',
        mapping: {
          PENDING: getSchemaPath(TotpSetupPendingDto),
          ENROLLED: getSchemaPath(TotpSetupEnrolledDto),
        },
      },
    },
  })
  async startSetup(@CurrentUser() user: AuthUser): Promise<TotpSetupStartResponse> {
    return this.totpStrategy.startSetup(user.userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('setup/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'TOTP 등록 완료 — 1회 검증 후 영구 저장' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWOFA_TOTP_INVALID_CODE', 'TWOFA_SETUP_NOT_SUPPORTED')
  async completeSetup(@CurrentUser() user: AuthUser, @Body() body: TotpSetupCompleteBodyDto): Promise<void> {
    await this.totpStrategy.completeSetup(user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'TOTP 등록 목록 조회 (user당 최대 1개)' })
  @ApiResponse({ status: HttpStatus.OK, type: TotpListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<TotpListResponseDto> {
    const instances = await this.totpStrategy.list(user.userId);
    return { instances };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'TOTP 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FORBIDDEN', 'TWOFA_LAST_STRATEGY_CANNOT_REMOVE')
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.twoFaService.removeStrategy(user.userId, 'TOTP', id);
  }
}

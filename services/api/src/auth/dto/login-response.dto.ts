import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class AuthenticatedResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] })
  status!: 'AUTHENTICATED';

  accessToken!: string;

  user!: UserDto;
}

export class TwoFaRequiredResponseDto {
  @ApiProperty({ enum: ['2FA_REQUIRED'] })
  status!: '2FA_REQUIRED';

  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  options!: string[];

  expiresAt!: Date;
}

export type LoginResponse = AuthenticatedResponseDto | TwoFaRequiredResponseDto;

import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class AuthenticatedResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] })
  status!: 'AUTHENTICATED';

  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class TwoFaRequiredResponseDto {
  @ApiProperty({ enum: ['2FA_REQUIRED'] })
  status!: '2FA_REQUIRED';

  @ApiProperty()
  challengeId!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export type LoginResponse = AuthenticatedResponseDto | TwoFaRequiredResponseDto;

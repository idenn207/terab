import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class ChallengeStatusPendingDto {
  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  correctNum!: string;

  @ApiProperty()
  remainingSeconds!: number;
}

export class ChallengeStatusApprovedDto {
  @ApiProperty({ enum: ['APPROVED'] })
  status!: 'APPROVED';

  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class ChallengeStatusDeniedDto {
  @ApiProperty({ enum: ['DENIED'] })
  status!: 'DENIED';
}

export class ChallengeStatusExpiredDto {
  @ApiProperty({ enum: ['EXPIRED'] })
  status!: 'EXPIRED';
}

export type ChallengeStatusResponse =
  | ChallengeStatusPendingDto
  | ChallengeStatusApprovedDto
  | ChallengeStatusDeniedDto
  | ChallengeStatusExpiredDto;

import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class ChallengeStatusPendingDto {
  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';

  options!: string[];

  correctNum!: string;

  remainingSeconds!: number;
}

export class ChallengeStatusApprovedDto {
  @ApiProperty({ enum: ['APPROVED'] })
  status!: 'APPROVED';

  accessToken!: string;

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

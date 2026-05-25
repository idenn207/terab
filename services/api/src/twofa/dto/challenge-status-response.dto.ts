import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ format: 'uuid' })
  userId!: string;
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

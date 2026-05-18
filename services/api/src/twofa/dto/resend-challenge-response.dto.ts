import { ApiProperty } from '@nestjs/swagger';

export class ResendChallengeResponseDto {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  options!: string[];

  expiresAt!: Date;
}

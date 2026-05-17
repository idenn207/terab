import { ApiProperty } from '@nestjs/swagger';

export class ResendChallengeResponseDto {
  @ApiProperty()
  challengeId!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

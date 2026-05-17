import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RespondChallengeBodyDto {
  @ApiProperty({ pattern: '^\\d{2}$' })
  @Matches(/^\d{2}$/, { message: 'selectedNumber must be exactly 2 digits' })
  selectedNumber!: string;
}

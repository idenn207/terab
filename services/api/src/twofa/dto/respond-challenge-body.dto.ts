import { Matches } from 'class-validator';

export class RespondChallengeBodyDto {
  @Matches(/^\d{2}$/, { message: 'selectedNumber must be exactly 2 digits' })
  selectedNumber!: string;
}

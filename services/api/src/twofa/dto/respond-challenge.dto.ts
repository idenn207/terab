import { IsString, Matches } from 'class-validator';

export class RespondChallengeDto {
  @IsString()
  @Matches(/^\d{2}$/)
  selectedNumber!: string;
}

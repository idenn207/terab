import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class RespondChallengeDto {
  @IsString()
  @Matches(/^\d{2}$/)
  selectedNumber!: string;

  @IsBoolean()
  @IsOptional()
  trustDevice?: boolean;
}

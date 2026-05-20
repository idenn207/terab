import { IsString, Matches, MinLength } from 'class-validator';

export class TotpSetupCompleteBodyDto {
  @IsString()
  @MinLength(16)
  secret!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}

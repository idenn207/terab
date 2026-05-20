import { IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';

export class CompleteChallengeBodyDto {
  @IsOptional()
  @IsIn(['PUSH', 'TOTP'])
  type?: 'PUSH' | 'TOTP';

  @ValidateIf((o: CompleteChallengeBodyDto) => o.type === 'TOTP')
  @Matches(/^\d{6}$/)
  code?: string;
}

import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInvitationBodyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}

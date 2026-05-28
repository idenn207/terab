import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LogoutBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  pushToken?: string;
}

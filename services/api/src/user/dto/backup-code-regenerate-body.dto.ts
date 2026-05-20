import { IsString, MaxLength, MinLength } from 'class-validator';

export class BackupCodeRegenerateBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  currentPassword!: string;
}

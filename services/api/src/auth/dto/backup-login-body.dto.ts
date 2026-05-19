import { IsString, MaxLength, MinLength } from 'class-validator';

export class BackupLoginBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  backupCode!: string;
}

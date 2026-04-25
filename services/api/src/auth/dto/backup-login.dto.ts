import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BackupLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  backupCode!: string;
}

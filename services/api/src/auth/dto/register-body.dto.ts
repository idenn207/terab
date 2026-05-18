import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterBodyDto {
  @IsUUID()
  token!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;
}

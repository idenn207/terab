import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;
}

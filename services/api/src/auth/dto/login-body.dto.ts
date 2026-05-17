import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginBodyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  password!: string;
}

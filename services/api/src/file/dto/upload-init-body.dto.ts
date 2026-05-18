import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, MinLength } from 'class-validator';

export class UploadInitBodyDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: '파일 크기 (byte). 최대 100 GiB', type: 'integer' })
  @IsInt()
  @IsPositive()
  @Max(100 * 1024 * 1024 * 1024)
  size!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(127)
  mimeType!: string;
}

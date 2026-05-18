import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, MinLength } from 'class-validator';

export class UploadInitBodyDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: '파일 크기 (byte). 최대 100 GiB', type: 'integer', minimum: 1 })
  @IsInt()
  @IsPositive()
  @Max(100 * 1024 * 1024 * 1024)
  size!: number;

  @ApiProperty({ minLength: 1, maxLength: 127 })
  @IsString()
  @MinLength(1)
  @MaxLength(127)
  mimeType!: string;
}

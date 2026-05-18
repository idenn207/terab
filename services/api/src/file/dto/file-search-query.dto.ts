import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class FileSearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  q!: string;

  @ApiProperty({ enum: ['all', 'folder'] })
  @IsEnum(['all', 'folder'])
  scope!: 'all' | 'folder';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class FileSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  q!: string;

  @ApiProperty({ enum: ['all', 'folder'] })
  @IsEnum(['all', 'folder'])
  scope!: 'all' | 'folder';

  @IsOptional()
  @IsUUID()
  folderId?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class TrashActionBodyDto {
  @ApiProperty({ enum: ['file', 'folder'] })
  @IsEnum(['file', 'folder'])
  type!: 'file' | 'folder';
}

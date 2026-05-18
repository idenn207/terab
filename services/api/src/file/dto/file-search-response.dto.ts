import { ApiProperty } from '@nestjs/swagger';
import { FileItemDto } from './file-item.dto';

export class FileSearchResponseDto {
  @ApiProperty({ type: FileItemDto, isArray: true })
  files!: FileItemDto[];
}

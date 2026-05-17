import { ApiProperty } from '@nestjs/swagger';
import { FileItemDto } from '../../file/dto';
import { FolderItemDto } from './folder-item.dto';

export class FolderChildrenResponseDto {
  @ApiProperty({ type: FolderItemDto, isArray: true })
  folders!: FolderItemDto[];

  @ApiProperty({ type: FileItemDto, isArray: true })
  files!: FileItemDto[];
}

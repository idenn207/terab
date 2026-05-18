import { FileItemDto } from '../../file/dto';
import { FolderItemDto } from './folder-item.dto';

export class FolderChildrenResponseDto {
  folders!: FolderItemDto[];

  files!: FileItemDto[];
}

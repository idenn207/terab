import type { FileItemDto } from '../../file/dto';
import type { FolderChildrenResponseDto, FolderItemDto } from '../../folder/dto';
import type { TrashItemDto } from '../../trash/dto';

export const FOLDER_ID = '00000000-0000-0000-0000-000000000001';
export const FILE_ID = '00000000-0000-0000-0000-000000000002';
export const PARENT_FOLDER_ID = '00000000-0000-0000-0000-000000000003';

export const mockFolderItem: FolderItemDto = {
  id: FOLDER_ID,
  name: 'test-folder',
  parentId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const mockFileItem: FileItemDto = {
  id: FILE_ID,
  name: 'test.txt',
  folderId: null,
  size: 1024,
  mimeType: 'text/plain',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const mockFolderChildrenResponse: FolderChildrenResponseDto = {
  folders: [mockFolderItem],
  files: [mockFileItem],
};

export const mockTrashItem: TrashItemDto = {
  id: FILE_ID,
  type: 'file',
  name: 'test.txt',
  deletedAt: new Date('2026-01-01T00:00:00.000Z'),
};

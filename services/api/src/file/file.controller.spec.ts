import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FILE_ID, FOLDER_ID, mockAuthUser, mockFileItem } from '@terab/test';
import { FileController } from './file.controller';
import { FileService } from './file.service';

describe('FileController', () => {
  let controller: FileController;
  let service: jest.Mocked<FileService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: FileService,
          useValue: {
            search: jest.fn(),
            rename: jest.fn(),
            move: jest.fn(),
            copy: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FileController);
    service = module.get(FileService) as jest.Mocked<FileService>;
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('FOLDER_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.search.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(
        controller.search(mockAuthUser, { q: 'test', scope: 'folder', folderId: undefined }),
      ).rejects.toMatchObject({ code: 'FOLDER_NOT_FOUND' });
    });

    it('전체 범위에서 파일을 검색하고 결과를 반환한다', async () => {
      service.search.mockResolvedValue({ files: [mockFileItem] });

      const result = await controller.search(mockAuthUser, { q: 'test', scope: 'all' });

      expect(service.search).toHaveBeenCalledWith(mockAuthUser.userId, { q: 'test', scope: 'all' });
      expect(result.files).toHaveLength(1);
    });
  });

  describe('rename', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.rename.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.rename(mockAuthUser, FILE_ID, { name: 'new.txt' })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('파일 이름을 변경하고 결과를 반환한다', async () => {
      const renamed = { ...mockFileItem, name: 'new.txt' };
      service.rename.mockResolvedValue(renamed);

      const result = await controller.rename(mockAuthUser, FILE_ID, { name: 'new.txt' });

      expect(service.rename).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID, { name: 'new.txt' });
      expect(result.name).toBe('new.txt');
    });
  });

  describe('move', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.move.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.move(mockAuthUser, FILE_ID, { folderId: FOLDER_ID })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('FOLDER_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.move.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.move(mockAuthUser, FILE_ID, { folderId: FOLDER_ID })).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('파일을 다른 폴더로 이동하고 결과를 반환한다', async () => {
      const moved = { ...mockFileItem, folderId: FOLDER_ID };
      service.move.mockResolvedValue(moved);

      const result = await controller.move(mockAuthUser, FILE_ID, { folderId: FOLDER_ID });

      expect(service.move).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID, { folderId: FOLDER_ID });
      expect(result.folderId).toBe(FOLDER_ID);
    });
  });

  describe('copy', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.copy.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.copy(mockAuthUser, FILE_ID, { folderId: null })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('FOLDER_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.copy.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.copy(mockAuthUser, FILE_ID, { folderId: FOLDER_ID })).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('파일을 복사하고 결과를 반환한다', async () => {
      const copied = { ...mockFileItem, id: '00000000-0000-0000-0000-000000000099' };
      service.copy.mockResolvedValue(copied);

      const result = await controller.copy(mockAuthUser, FILE_ID, { folderId: null });

      expect(service.copy).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID, { folderId: null });
      expect(result.id).toBe(copied.id);
    });
  });

  describe('remove', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.remove.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await expect(controller.remove(mockAuthUser, FILE_ID)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });

    it('파일을 소프트 삭제한다', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockAuthUser, FILE_ID);

      expect(service.remove).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID);
    });
  });
});

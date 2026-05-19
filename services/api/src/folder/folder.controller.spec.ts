import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FOLDER_ID, PARENT_FOLDER_ID, mockAuthUser, mockFolderChildrenResponse, mockFolderItem } from '@terab/test';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

describe('FolderController', () => {
  let controller: FolderController;
  let service: jest.Mocked<FolderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FolderController],
      providers: [
        {
          provide: FolderService,
          useValue: {
            getRoot: jest.fn(),
            getChildren: jest.fn(),
            create: jest.fn(),
            rename: jest.fn(),
            move: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FolderController);
    service = module.get(FolderService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('getRoot', () => {
    it('현재 사용자 id로 service.getRoot를 호출하고 결과를 반환한다', async () => {
      service.getRoot.mockResolvedValue(mockFolderChildrenResponse);

      const result = await controller.getRoot(mockAuthUser);

      expect(service.getRoot).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual(mockFolderChildrenResponse);
    });
  });

  describe('getChildren', () => {
    it('service.getChildren에서 FOLDER_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.getChildren.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.getChildren(mockAuthUser, FOLDER_ID)).rejects.toThrow(ApiException);
      await expect(controller.getChildren(mockAuthUser, FOLDER_ID)).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('userId, folderId 순서로 service.getChildren을 호출하고 결과를 반환한다', async () => {
      service.getChildren.mockResolvedValue(mockFolderChildrenResponse);

      const result = await controller.getChildren(mockAuthUser, FOLDER_ID);

      expect(service.getChildren).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID);
      expect(result).toEqual(mockFolderChildrenResponse);
    });
  });

  describe('create', () => {
    it('service.create에서 FOLDER_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.create.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      const body = { name: 'child', parentId: PARENT_FOLDER_ID };

      await expect(controller.create(mockAuthUser, body)).rejects.toThrow(ApiException);
      await expect(controller.create(mockAuthUser, body)).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('루트에 폴더를 생성한다', async () => {
      service.create.mockResolvedValue(mockFolderItem);

      const body = { name: 'new-folder', parentId: null };
      const result = await controller.create(mockAuthUser, body);

      expect(service.create).toHaveBeenCalledWith(mockAuthUser.userId, body);
      expect(result).toEqual(mockFolderItem);
    });

    it('하위 폴더를 생성한다', async () => {
      const childFolder = { ...mockFolderItem, parentId: PARENT_FOLDER_ID };
      service.create.mockResolvedValue(childFolder);

      const body = { name: 'child-folder', parentId: PARENT_FOLDER_ID };
      const result = await controller.create(mockAuthUser, body);

      expect(service.create).toHaveBeenCalledWith(mockAuthUser.userId, body);
      expect(result.parentId).toBe(PARENT_FOLDER_ID);
    });
  });

  describe('rename', () => {
    it('service.rename에서 FOLDER_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.rename.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      const body = { name: 'renamed' };

      await expect(controller.rename(mockAuthUser, FOLDER_ID, body)).rejects.toThrow(ApiException);
      await expect(controller.rename(mockAuthUser, FOLDER_ID, body)).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('폴더 이름을 변경한다', async () => {
      const renamed = { ...mockFolderItem, name: 'renamed-folder' };
      service.rename.mockResolvedValue(renamed);

      const body = { name: 'renamed-folder' };
      const result = await controller.rename(mockAuthUser, FOLDER_ID, body);

      expect(service.rename).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID, body);
      expect(result.name).toBe('renamed-folder');
    });
  });

  describe('move', () => {
    it('service.move에서 INVALID_MOVE_TARGET을 던지면 그대로 전파한다', async () => {
      service.move.mockRejectedValue(new ApiException('INVALID_MOVE_TARGET'));

      const body = { parentId: PARENT_FOLDER_ID };

      await expect(controller.move(mockAuthUser, FOLDER_ID, body)).rejects.toThrow(ApiException);
      await expect(controller.move(mockAuthUser, FOLDER_ID, body)).rejects.toMatchObject({
        code: 'INVALID_MOVE_TARGET',
      });
    });

    it('폴더를 다른 폴더로 이동한다', async () => {
      const moved = { ...mockFolderItem, parentId: PARENT_FOLDER_ID };
      service.move.mockResolvedValue(moved);

      const body = { parentId: PARENT_FOLDER_ID };
      const result = await controller.move(mockAuthUser, FOLDER_ID, body);

      expect(service.move).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID, body);
      expect(result.parentId).toBe(PARENT_FOLDER_ID);
    });
  });

  describe('remove', () => {
    it('service.remove에서 FOLDER_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.remove.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.remove(mockAuthUser, FOLDER_ID)).rejects.toThrow(ApiException);
      await expect(controller.remove(mockAuthUser, FOLDER_ID)).rejects.toMatchObject({
        code: 'FOLDER_NOT_FOUND',
      });
    });

    it('폴더를 소프트 삭제한다', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockAuthUser, FOLDER_ID);

      expect(service.remove).toHaveBeenCalledWith(mockAuthUser.userId, FOLDER_ID);
    });
  });
});

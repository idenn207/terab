import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { FOLDER_ID, PARENT_FOLDER_ID, mockAuthUser, mockFolderChildrenResponse, mockFolderItem } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

const mockFolderService = {
  getRoot: jest.fn(),
  getChildren: jest.fn(),
  create: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  remove: jest.fn(),
};

describe('FolderController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [FolderController],
      providers: [
        { provide: FolderService, useValue: mockFolderService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockAuthUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('인스턴스가 생성된다', () => {
    expect(app).toBeDefined();
  });

  describe('GET /folders/root', () => {
    it('루트 목록을 반환한다', async () => {
      mockFolderService.getRoot.mockResolvedValue(mockFolderChildrenResponse);

      const res = await request(app.getHttpServer()).get('/folders/root').expect(HttpStatus.OK);

      expect(mockFolderService.getRoot).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(res.body.folders).toHaveLength(1);
      expect(res.body.files).toHaveLength(1);
    });
  });

  describe('GET /folders/:id/children', () => {
    it('서브폴더 및 파일 목록을 반환한다', async () => {
      mockFolderService.getChildren.mockResolvedValue(mockFolderChildrenResponse);

      const res = await request(app.getHttpServer())
        .get(`/folders/${FOLDER_ID}/children`)
        .expect(HttpStatus.OK);

      expect(mockFolderService.getChildren).toHaveBeenCalledWith(FOLDER_ID, mockAuthUser.userId);
      expect(res.body.folders).toBeDefined();
      expect(res.body.files).toBeDefined();
    });
  });

  describe('POST /folders', () => {
    it('루트 폴더를 생성한다', async () => {
      mockFolderService.create.mockResolvedValue(mockFolderItem);

      const res = await request(app.getHttpServer())
        .post('/folders')
        .send({ name: 'new-folder', parentId: null })
        .expect(HttpStatus.CREATED);

      expect(mockFolderService.create).toHaveBeenCalledWith(mockAuthUser.userId, 'new-folder', null);
      expect(res.body.id).toBe(mockFolderItem.id);
    });

    it('하위 폴더를 생성한다', async () => {
      const childFolder = { ...mockFolderItem, parentId: PARENT_FOLDER_ID };
      mockFolderService.create.mockResolvedValue(childFolder);

      const res = await request(app.getHttpServer())
        .post('/folders')
        .send({ name: 'child-folder', parentId: PARENT_FOLDER_ID })
        .expect(HttpStatus.CREATED);

      expect(mockFolderService.create).toHaveBeenCalledWith(mockAuthUser.userId, 'child-folder', PARENT_FOLDER_ID);
      expect(res.body.parentId).toBe(PARENT_FOLDER_ID);
    });
  });

  describe('PATCH /folders/:id', () => {
    it('폴더 이름을 변경한다', async () => {
      const renamed = { ...mockFolderItem, name: 'renamed-folder' };
      mockFolderService.rename.mockResolvedValue(renamed);

      const res = await request(app.getHttpServer())
        .patch(`/folders/${FOLDER_ID}`)
        .send({ name: 'renamed-folder' })
        .expect(HttpStatus.OK);

      expect(mockFolderService.rename).toHaveBeenCalledWith(FOLDER_ID, mockAuthUser.userId, 'renamed-folder');
      expect(res.body.name).toBe('renamed-folder');
    });
  });

  describe('PATCH /folders/:id/move', () => {
    it('폴더를 다른 폴더로 이동한다', async () => {
      const moved = { ...mockFolderItem, parentId: PARENT_FOLDER_ID };
      mockFolderService.move.mockResolvedValue(moved);

      const res = await request(app.getHttpServer())
        .patch(`/folders/${FOLDER_ID}/move`)
        .send({ parentId: PARENT_FOLDER_ID })
        .expect(HttpStatus.OK);

      expect(mockFolderService.move).toHaveBeenCalledWith(FOLDER_ID, mockAuthUser.userId, PARENT_FOLDER_ID);
      expect(res.body.parentId).toBe(PARENT_FOLDER_ID);
    });

    it('폴더를 루트로 이동한다', async () => {
      mockFolderService.move.mockResolvedValue(mockFolderItem);

      const res = await request(app.getHttpServer())
        .patch(`/folders/${FOLDER_ID}/move`)
        .send({ parentId: null })
        .expect(HttpStatus.OK);

      expect(mockFolderService.move).toHaveBeenCalledWith(FOLDER_ID, mockAuthUser.userId, null);
      expect(res.body.parentId).toBeNull();
    });
  });

  describe('DELETE /folders/:id', () => {
    it('폴더를 소프트 삭제한다', async () => {
      mockFolderService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer()).delete(`/folders/${FOLDER_ID}`).expect(HttpStatus.NO_CONTENT);

      expect(mockFolderService.remove).toHaveBeenCalledWith(FOLDER_ID, mockAuthUser.userId);
    });

    it('하위 폴더와 파일이 있어도 cascade 삭제를 서비스에 위임한다', async () => {
      mockFolderService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer()).delete(`/folders/${FOLDER_ID}`).expect(HttpStatus.NO_CONTENT);

      // 컨트롤러는 자식 목록을 조회하지 않고 remove만 호출하여 cascade를 서비스에 완전히 위임
      expect(mockFolderService.remove).toHaveBeenCalledTimes(1);
      expect(mockFolderService.getChildren).not.toHaveBeenCalled();
    });
  });
});

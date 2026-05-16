import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { FILE_ID, FOLDER_ID, mockAuthUser, mockFileItem } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { FileController } from './file.controller';
import { FileService } from './file.service';

const mockFileService = {
  rename: jest.fn(),
  move: jest.fn(),
  copy: jest.fn(),
  remove: jest.fn(),
  search: jest.fn(),
};

describe('FileController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [FileController],
      providers: [
        { provide: FileService, useValue: mockFileService },
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

  describe('PATCH /files/:id (이름 변경)', () => {
    it('파일 이름을 변경한다', async () => {
      const renamed = { ...mockFileItem, name: 'renamed.txt' };
      mockFileService.rename.mockResolvedValue(renamed);

      const res = await request(app.getHttpServer())
        .patch(`/files/${FILE_ID}`)
        .send({ name: 'renamed.txt' })
        .expect(HttpStatus.OK);

      expect(mockFileService.rename).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId, 'renamed.txt');
      expect(res.body.name).toBe('renamed.txt');
    });
  });

  describe('PATCH /files/:id/move (이동)', () => {
    it('파일을 다른 폴더로 이동한다', async () => {
      const moved = { ...mockFileItem, folderId: FOLDER_ID };
      mockFileService.move.mockResolvedValue(moved);

      const res = await request(app.getHttpServer())
        .patch(`/files/${FILE_ID}/move`)
        .send({ folderId: FOLDER_ID })
        .expect(HttpStatus.OK);

      expect(mockFileService.move).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId, FOLDER_ID);
      expect(res.body.folderId).toBe(FOLDER_ID);
    });

    it('파일을 루트로 이동한다', async () => {
      mockFileService.move.mockResolvedValue(mockFileItem);

      const res = await request(app.getHttpServer())
        .patch(`/files/${FILE_ID}/move`)
        .send({ folderId: null })
        .expect(HttpStatus.OK);

      expect(mockFileService.move).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId, null);
      expect(res.body.folderId).toBeNull();
    });
  });

  describe('POST /files/:id/copy (복사)', () => {
    it('파일을 복사한다', async () => {
      const copied = { ...mockFileItem, id: '00000000-0000-0000-0000-000000000099' };
      mockFileService.copy.mockResolvedValue(copied);

      const res = await request(app.getHttpServer())
        .post(`/files/${FILE_ID}/copy`)
        .send({ folderId: null })
        .expect(HttpStatus.CREATED);

      expect(mockFileService.copy).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId, null);
      expect(res.body.id).toBe(copied.id);
    });

    it('파일을 다른 폴더에 복사한다', async () => {
      const copied = { ...mockFileItem, id: '00000000-0000-0000-0000-000000000099', folderId: FOLDER_ID };
      mockFileService.copy.mockResolvedValue(copied);

      await request(app.getHttpServer())
        .post(`/files/${FILE_ID}/copy`)
        .send({ folderId: FOLDER_ID })
        .expect(HttpStatus.CREATED);

      expect(mockFileService.copy).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId, FOLDER_ID);
    });
  });

  describe('DELETE /files/:id (삭제)', () => {
    it('파일을 소프트 삭제한다', async () => {
      mockFileService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer()).delete(`/files/${FILE_ID}`).expect(HttpStatus.NO_CONTENT);

      expect(mockFileService.remove).toHaveBeenCalledWith(FILE_ID, mockAuthUser.userId);
    });
  });

  describe('GET /files/search (검색)', () => {
    it('전체 범위에서 파일을 검색한다', async () => {
      mockFileService.search.mockResolvedValue({ files: [mockFileItem] });

      const res = await request(app.getHttpServer())
        .get('/files/search')
        .query({ q: 'test', scope: 'all' })
        .expect(HttpStatus.OK);

      expect(mockFileService.search).toHaveBeenCalledWith(mockAuthUser.userId, 'test', 'all', undefined);
      expect(res.body.files).toHaveLength(1);
    });

    it('특정 폴더 내에서 파일을 검색한다', async () => {
      mockFileService.search.mockResolvedValue({ files: [mockFileItem] });

      await request(app.getHttpServer())
        .get('/files/search')
        .query({ q: 'test', scope: 'folder', folderId: FOLDER_ID })
        .expect(HttpStatus.OK);

      expect(mockFileService.search).toHaveBeenCalledWith(mockAuthUser.userId, 'test', 'folder', FOLDER_ID);
    });
  });
});

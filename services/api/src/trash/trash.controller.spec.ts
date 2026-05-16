import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FILE_ID, FOLDER_ID, mockAuthUser, mockTrashItem } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

const mockTrashService = {
  list: jest.fn(),
  restore: jest.fn(),
  permanentDelete: jest.fn(),
};

describe('TrashController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [TrashController],
      providers: [
        { provide: TrashService, useValue: mockTrashService },
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

  describe('GET /trash', () => {
    it('소프트 삭제된 파일·폴더 목록을 반환한다', async () => {
      mockTrashService.list.mockResolvedValue({ items: [mockTrashItem] });

      const res = await request(app.getHttpServer()).get('/trash').expect(HttpStatus.OK);

      expect(mockTrashService.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].type).toBe('file');
    });
  });

  describe('POST /trash/:id/restore', () => {
    it('휴지통의 파일을 복원한다', async () => {
      mockTrashService.restore.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/trash/${FILE_ID}/restore`)
        .send({ type: 'file' })
        .expect(HttpStatus.NO_CONTENT);

      expect(mockTrashService.restore).toHaveBeenCalledWith(FILE_ID, 'file', mockAuthUser.userId);
    });

    it('휴지통의 폴더를 복원한다 (하위 항목 cascade 포함)', async () => {
      mockTrashService.restore.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/trash/${FOLDER_ID}/restore`)
        .send({ type: 'folder' })
        .expect(HttpStatus.NO_CONTENT);

      expect(mockTrashService.restore).toHaveBeenCalledWith(FOLDER_ID, 'folder', mockAuthUser.userId);
    });

    it('휴지통에 없는 파일을 복원하면 404를 반환한다', async () => {
      // parentId가 존재하지 않거나 이미 삭제되지 않은 항목 복원 시도
      mockTrashService.restore.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));

      await request(app.getHttpServer())
        .post(`/trash/${FILE_ID}/restore`)
        .send({ type: 'file' })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('휴지통에 없는 폴더를 복원하면 404를 반환한다', async () => {
      mockTrashService.restore.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await request(app.getHttpServer())
        .post(`/trash/${FOLDER_ID}/restore`)
        .send({ type: 'folder' })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /trash/:id (영구 삭제)', () => {
    it('파일을 영구 삭제한다', async () => {
      mockTrashService.permanentDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/trash/${FILE_ID}`)
        .send({ type: 'file' })
        .expect(HttpStatus.NO_CONTENT);

      expect(mockTrashService.permanentDelete).toHaveBeenCalledWith(FILE_ID, 'file', mockAuthUser.userId);
    });

    it('폴더를 영구 삭제한다 (하위 파일 MinIO까지 cascade 삭제)', async () => {
      mockTrashService.permanentDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/trash/${FOLDER_ID}`)
        .send({ type: 'folder' })
        .expect(HttpStatus.NO_CONTENT);

      expect(mockTrashService.permanentDelete).toHaveBeenCalledWith(FOLDER_ID, 'folder', mockAuthUser.userId);
    });
  });
});

import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { FILE_ID, mockAuthUser } from '@terab/test';
import { Readable } from 'node:stream';
import request from 'supertest';
import { FileDownloadController } from './file-download.controller';
import { FileService } from './file.service';

const mockFileService = {
  getDownloadStream: jest.fn(),
  getObjectStream: jest.fn(),
  resolveZipFiles: jest.fn(),
};

const SECOND_FILE_ID = '00000000-0000-0000-0000-000000000009';

describe('FileDownloadController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileDownloadController],
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

  describe('GET /files/:id/download', () => {
    it('파일 스트림과 Content 헤더를 반환한다', async () => {
      mockFileService.getDownloadStream.mockResolvedValue({
        stream: Readable.from(['file content']),
        name: 'test.txt',
        size: 12,
        mimeType: 'text/plain',
      });

      const res = await request(app.getHttpServer())
        .get(`/files/${FILE_ID}/download`)
        .expect(HttpStatus.OK);

      expect(mockFileService.getDownloadStream).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain('test.txt');
      expect(res.headers['content-length']).toBe('12');
    });

    it('파일명에 한글이 포함되면 URL 인코딩하여 반환한다', async () => {
      mockFileService.getDownloadStream.mockResolvedValue({
        stream: Readable.from(['내용']),
        name: '한글파일.txt',
        size: 6,
        mimeType: 'text/plain',
      });

      const res = await request(app.getHttpServer())
        .get(`/files/${FILE_ID}/download`)
        .expect(HttpStatus.OK);

      expect(res.headers['content-disposition']).toContain(encodeURIComponent('한글파일.txt'));
    });
  });

  describe('POST /files/download/zip', () => {
    it('여러 파일을 ZIP으로 다운로드한다', async () => {
      mockFileService.resolveZipFiles.mockResolvedValue([
        { name: 'file1.txt', key: `${mockAuthUser.userId}/key1` },
        { name: 'file2.txt', key: `${mockAuthUser.userId}/key2` },
      ]);
      mockFileService.getObjectStream.mockResolvedValue(Readable.from(['content']));

      const res = await request(app.getHttpServer())
        .post('/files/download/zip')
        .send({ fileIds: [FILE_ID, SECOND_FILE_ID] })
        .expect(HttpStatus.CREATED);

      expect(mockFileService.resolveZipFiles).toHaveBeenCalledWith(
        [FILE_ID, SECOND_FILE_ID],
        mockAuthUser.userId,
      );
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('download.zip');
    });

    it('100개를 초과하면 ZIP_LIMIT_EXCEEDED를 반환한다', async () => {
      const overLimitIds = Array.from({ length: 101 }, (_, i) => `file-${i}`);

      await request(app.getHttpServer())
        .post('/files/download/zip')
        .send({ fileIds: overLimitIds })
        .expect(HttpStatus.BAD_REQUEST);

      expect(mockFileService.resolveZipFiles).not.toHaveBeenCalled();
    });

    it('fileIds가 없으면 ZIP_LIMIT_EXCEEDED를 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/files/download/zip')
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      expect(mockFileService.resolveZipFiles).not.toHaveBeenCalled();
    });
  });
});

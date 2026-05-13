import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { FileUploadController } from './file-upload.controller';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionService = {
  init: jest.fn(),
  complete: jest.fn(),
};

describe('FileUploadController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [FileUploadController],
      providers: [
        { provide: UploadSessionService, useValue: mockUploadSessionService },
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

  it('POST /files/upload-init은 service.init을 호출하고 201을 반환한다', async () => {
    mockUploadSessionService.init.mockResolvedValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      parts: [{ partNumber: 1, uploadUrl: 'https://storage.example/put' }],
      uploadHeaders: { 'Content-Type': 'image/png' },
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .post('/files/upload-init')
      .send({ name: 't.png', size: 1024, mimeType: 'image/png' })
      .expect(HttpStatus.CREATED);

    expect(mockUploadSessionService.init).toHaveBeenCalledWith(
      mockAuthUser.userId,
      expect.objectContaining({
        name: 't.png',
        size: 1024,
        mimeType: 'image/png',
      }),
    );
    expect(res.body.sessionId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('POST /files/:sessionId/upload-complete는 service.complete를 호출한다', async () => {
    const sessionId = '11111111-1111-1111-1111-111111111111';
    mockUploadSessionService.complete.mockResolvedValue({
      id: 'file-id',
      name: 't.png',
      folderId: null,
      size: 1024,
      mimeType: 'image/png',
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .post(`/files/${sessionId}/upload-complete`)
      .send({ parts: [{ partNumber: 1, etag: 'e' }] })
      .expect(HttpStatus.CREATED);

    expect(mockUploadSessionService.complete).toHaveBeenCalledWith(mockAuthUser.userId, sessionId, [
      { partNumber: 1, etag: 'e' },
    ]);
    expect(res.body.id).toBe('file-id');
  });
});

import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser, mockFileItem } from '@terab/test';
import { FileUploadController } from './file-upload.controller';
import { UploadSessionService } from './upload-session.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

const mockUploadInitResponse = {
  sessionId: SESSION_ID,
  parts: [{ partNumber: 1, uploadUrl: 'https://storage.example/put' }],
  uploadHeaders: { 'Content-Type': 'image/png' },
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
};

describe('FileUploadController', () => {
  let controller: FileUploadController;
  let service: jest.Mocked<UploadSessionService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileUploadController],
      providers: [
        {
          provide: UploadSessionService,
          useValue: {
            init: jest.fn(),
            complete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FileUploadController);
    service = module.get(UploadSessionService) as jest.Mocked<UploadSessionService>;
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('init', () => {
    const body = { name: 'test.png', size: 1024, mimeType: 'image/png' };

    it('FOLDER_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.init.mockRejectedValue(new ApiException('FOLDER_NOT_FOUND'));

      await expect(controller.init(mockAuthUser, body)).rejects.toMatchObject({ code: 'FOLDER_NOT_FOUND' });
    });

    it('FILE_TOO_LARGE가 발생하면 그대로 전파한다', async () => {
      service.init.mockRejectedValue(new ApiException('FILE_TOO_LARGE'));

      await expect(controller.init(mockAuthUser, body)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    });

    it('업로드 세션을 생성하고 presigned URL을 반환한다', async () => {
      service.init.mockResolvedValue(mockUploadInitResponse);

      const result = await controller.init(mockAuthUser, body);

      expect(service.init).toHaveBeenCalledWith(mockAuthUser.userId, body);
      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.parts).toHaveLength(1);
    });
  });

  describe('complete', () => {
    const parts = [{ partNumber: 1, etag: 'etag-value-1' }];

    it('UPLOAD_SESSION_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.complete.mockRejectedValue(new ApiException('UPLOAD_SESSION_NOT_FOUND'));

      await expect(controller.complete(mockAuthUser, SESSION_ID, { parts })).rejects.toMatchObject({
        code: 'UPLOAD_SESSION_NOT_FOUND',
      });
    });

    it('UPLOAD_SESSION_EXPIRED가 발생하면 그대로 전파한다', async () => {
      service.complete.mockRejectedValue(new ApiException('UPLOAD_SESSION_EXPIRED'));

      await expect(controller.complete(mockAuthUser, SESSION_ID, { parts })).rejects.toMatchObject({
        code: 'UPLOAD_SESSION_EXPIRED',
      });
    });

    it('UPLOAD_OBJECT_MISSING가 발생하면 그대로 전파한다', async () => {
      service.complete.mockRejectedValue(new ApiException('UPLOAD_OBJECT_MISSING'));

      await expect(controller.complete(mockAuthUser, SESSION_ID, { parts })).rejects.toMatchObject({
        code: 'UPLOAD_OBJECT_MISSING',
      });
    });

    it('UPLOAD_SIZE_MISMATCH가 발생하면 그대로 전파한다', async () => {
      service.complete.mockRejectedValue(new ApiException('UPLOAD_SIZE_MISMATCH'));

      await expect(controller.complete(mockAuthUser, SESSION_ID, { parts })).rejects.toMatchObject({
        code: 'UPLOAD_SIZE_MISMATCH',
      });
    });

    it('업로드를 완료하고 FileItemDto를 반환한다', async () => {
      service.complete.mockResolvedValue(mockFileItem);

      const result = await controller.complete(mockAuthUser, SESSION_ID, { parts });

      expect(service.complete).toHaveBeenCalledWith(mockAuthUser.userId, SESSION_ID, parts);
      expect(result.id).toBe(mockFileItem.id);
    });
  });
});

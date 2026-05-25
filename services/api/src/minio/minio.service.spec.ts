import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider, mockConfigService } from '@terab/test';
import { MinioService } from './minio.service';

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfigService },
        createPinoLoggerProvider(MinioService.name),
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  describe('presigned 메서드', () => {
    it('presignedPutObject는 presignClient 호출 결과 URL을 반환한다', async () => {
      // presignClient는 private — spy로 접근
      // minio-js 8.x: presignedPutObject(bucket, key, expires) — Content-Type 인자 없음
      // MIME sanitization은 UploadSessionService.init()에서 담당, uploadHeaders로 클라이언트에 반환
      const spy = jest
        .spyOn((service as any).presignClient, 'presignedPutObject')
        .mockResolvedValue('https://presigned.example/put');
      const url = await service.presignedPutObject('u1/abc', 3600);
      expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 3600);
      expect(url).toBe('https://presigned.example/put');
    });

    it('createMultipartUpload는 minio-js Core API를 호출해 uploadId를 반환한다', async () => {
      const spy = jest.spyOn((service as any).client, 'initiateNewMultipartUpload').mockResolvedValue('upload-id-xyz');
      const result = await service.createMultipartUpload('u1/abc', 'video/mp4');
      expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', { 'Content-Type': 'video/mp4' });
      expect(result).toEqual({ uploadId: 'upload-id-xyz' });
    });

    it('presignedPutPart는 part PUT용 URL을 반환한다', async () => {
      const spy = jest
        .spyOn((service as any).presignClient, 'presignedUrl')
        .mockResolvedValue('https://presigned.example/part?uploadId=u&partNumber=1');
      const url = await service.presignedPutPart('u1/abc', 'upload-id-xyz', 1, 3600);
      expect(spy).toHaveBeenCalledWith('PUT', 'drive', 'u1/abc', 3600, { uploadId: 'upload-id-xyz', partNumber: '1' });
      expect(url).toMatch(/^https:\/\/presigned\.example/);
    });

    it('completeMultipartUpload는 minio-js completeMultipartUpload를 호출한다', async () => {
      const spy = jest.spyOn((service as any).client, 'completeMultipartUpload').mockResolvedValue(undefined);
      await service.completeMultipartUpload('u1/abc', 'upload-id-xyz', [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
      ]);
      expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 'upload-id-xyz', [
        { part: 1, etag: 'etag-1' },
        { part: 2, etag: 'etag-2' },
      ]);
    });

    it('abortMultipartUpload는 객체를 abort한다', async () => {
      const spy = jest.spyOn((service as any).client, 'abortMultipartUpload').mockResolvedValue(undefined);
      await service.abortMultipartUpload('u1/abc', 'upload-id-xyz');
      expect(spy).toHaveBeenCalledWith('drive', 'u1/abc', 'upload-id-xyz');
    });
  });
});

import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { FILE_ID, mockAuthUser } from '@terab/test';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { FileDownloadController } from './file-download.controller';
import { FileService } from './file.service';

const SECOND_FILE_ID = '00000000-0000-0000-0000-000000000009';

describe('FileDownloadController', () => {
  let controller: FileDownloadController;
  let service: jest.Mocked<FileService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileDownloadController],
      providers: [
        {
          provide: FileService,
          useValue: {
            getDownloadStream: jest.fn(),
            getObjectStream: jest.fn(),
            resolveZipFiles: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FileDownloadController);
    service = module.get(FileService) as jest.Mocked<FileService>;
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('downloadFile', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.getDownloadStream.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));
      const mockRes = { set: jest.fn() } as unknown as Response;

      await expect(controller.downloadFile(mockAuthUser, FILE_ID, mockRes)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });

    it('스트림과 Content 헤더를 설정하고 StreamableFile을 반환한다', async () => {
      service.getDownloadStream.mockResolvedValue({
        stream: Readable.from(['file content']),
        name: 'test.txt',
        size: 12,
        mimeType: 'text/plain',
      });
      const mockRes = { set: jest.fn() } as unknown as Response;

      const result = await controller.downloadFile(mockAuthUser, FILE_ID, mockRes);

      expect(service.getDownloadStream).toHaveBeenCalledWith(mockAuthUser.userId, FILE_ID);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'text/plain',
          'Content-Length': '12',
        }),
      );
      expect(result).toBeDefined();
    });

    it('파일명에 한글이 포함되면 URL 인코딩하여 헤더를 설정한다', async () => {
      service.getDownloadStream.mockResolvedValue({
        stream: Readable.from(['내용']),
        name: '한글파일.txt',
        size: 6,
        mimeType: 'text/plain',
      });
      const mockRes = { set: jest.fn() } as unknown as Response;

      await controller.downloadFile(mockAuthUser, FILE_ID, mockRes);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition': expect.stringContaining(encodeURIComponent('한글파일.txt')),
        }),
      );
    });
  });

  describe('downloadZip', () => {
    it('FILE_NOT_FOUND가 발생하면 그대로 전파한다', async () => {
      service.resolveZipFiles.mockRejectedValue(new ApiException('FILE_NOT_FOUND'));
      const mockRes = { set: jest.fn() } as unknown as Response;

      await expect(
        controller.downloadZip(mockAuthUser, { fileIds: [FILE_ID] }, mockRes),
      ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });

    it('ZIP 스트림과 Content 헤더를 설정하고 StreamableFile을 반환한다', async () => {
      service.resolveZipFiles.mockResolvedValue([
        { name: 'file1.txt', key: `${mockAuthUser.userId}/key1` },
        { name: 'file2.txt', key: `${mockAuthUser.userId}/key2` },
      ]);
      service.getObjectStream.mockResolvedValue(Readable.from(['content']));
      const mockRes = { set: jest.fn() } as unknown as Response;

      const result = await controller.downloadZip(mockAuthUser, { fileIds: [FILE_ID, SECOND_FILE_ID] }, mockRes);

      expect(service.resolveZipFiles).toHaveBeenCalledWith([FILE_ID, SECOND_FILE_ID], mockAuthUser.userId);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/zip',
          'Content-Disposition': expect.stringContaining('download.zip'),
        }),
      );
      expect(result).toBeDefined();
    });
  });
});

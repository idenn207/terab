import { Test } from '@nestjs/testing';
import { FileDownloadController } from './file-download.controller';
import { FileService } from './file.service';

const mockFileService = {
  getDownloadStream: jest.fn(),
  getObjectStream: jest.fn(),
  resolveZipFiles: jest.fn(),
};

describe('FileDownloadController', () => {
  let controller: FileDownloadController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileDownloadController],
      providers: [{ provide: FileService, useValue: mockFileService }],
    }).compile();
    controller = module.get(FileDownloadController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});

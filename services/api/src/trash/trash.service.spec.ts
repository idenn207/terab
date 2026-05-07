import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { MinioService } from '../minio/minio.service';
import { TrashRepository } from './trash.repository';
import { TrashService } from './trash.service';

const mockTrashRepository = {
  findAllDeleted: jest.fn(),
  findDeletedFile: jest.fn(),
  findDeletedFolder: jest.fn(),
  restoreFile: jest.fn(),
  restoreFolder: jest.fn(),
  permanentDeleteFile: jest.fn(),
  permanentDeleteFolderTree: jest.fn(),
};

const mockMinioService = { removeObject: jest.fn(), removeObjects: jest.fn() };

describe('TrashService', () => {
  let service: TrashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TrashRepository, useValue: mockTrashRepository },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<TrashService>(TrashService);
  });

  it('인스턴스가 생성된다', () => {
    expect(service).toBeDefined();
  });

  it('restore file은 파일이 없으면 FILE_NOT_FOUND를 던진다', async () => {
    mockTrashRepository.findDeletedFile.mockResolvedValue(null);
    await expect(service.restore('id', 'file', 'u1')).rejects.toThrow(ApiException);
  });

  it('permanentDelete file은 minioKey를 조회 후 MinIO와 DB를 삭제한다', async () => {
    mockTrashRepository.permanentDeleteFile.mockResolvedValue('user-1/key-1');
    await service.permanentDelete('id', 'file', 'u1');
    expect(mockMinioService.removeObject).toHaveBeenCalledWith('user-1/key-1');
  });
});

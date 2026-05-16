import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { FolderRepository } from './folder.repository';

describe('FolderRepository', () => {
  let repo: FolderRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FolderRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get<FolderRepository>(FolderRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('findRootChildren은 userId로 루트 항목을 조회한다', async () => {
    const { mockDbWhere } = await import('@terab/test');
    mockDbWhere.mockResolvedValue([]);
    const result = await repo.findRootChildren('user-1');
    expect(result).toEqual([]);
  });

  it('findRootFiles는 루트의 파일 목록을 FileItem 형태로 반환한다', async () => {
    const { mockDbWhere } = await import('@terab/test');
    mockDbWhere.mockResolvedValue([]);
    const result = await repo.findRootFiles('user-1');
    expect(result).toEqual([]);
  });

  it('findRootFiles는 folderId가 null인 경우를 처리한다', async () => {
    const { mockDbWhere } = await import('@terab/test');
    const raw = {
      id: 'f1',
      name: 'a.txt',
      folderId: null,
      size: 100,
      mimeType: 'text/plain',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbWhere.mockResolvedValue([raw]);
    const result = await repo.findRootFiles('user-1');
    expect(result[0].folderId).toBeNull();
  });

  it('findByFolder는 특정 폴더의 파일 목록을 FileItem 형태로 반환한다', async () => {
    const { mockDbWhere } = await import('@terab/test');
    mockDbWhere.mockResolvedValue([]);
    const result = await repo.findFilesByFolder('folder-1', 'user-1');
    expect(result).toEqual([]);
  });
});

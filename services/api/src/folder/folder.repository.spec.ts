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
});

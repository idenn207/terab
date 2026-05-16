import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { FileRepository } from './file.repository';

describe('FileRepository', () => {
  let repo: FileRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get<FileRepository>(FileRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('findByIdAndUser는 일치하는 파일이 없으면 null을 반환한다', async () => {
    const { mockDbLimit } = await import('@terab/test');
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findByIdAndUser('file-1', 'user-1');
    expect(result).toBeNull();
  });
});

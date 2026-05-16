import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { TrashRepository } from './trash.repository';

describe('TrashRepository', () => {
  let repo: TrashRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get<TrashRepository>(TrashRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('findAllDeleted는 소프트 삭제된 파일과 폴더를 합쳐 반환한다', async () => {
    const { mockDbWhere } = await import('@terab/test');
    mockDbWhere.mockResolvedValue([]);
    const result = await repo.findAllDeleted('user-1');
    expect(Array.isArray(result)).toBe(true);
  });
});

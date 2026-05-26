import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbFor,
  mockDbLimit,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { UploadSessionRepository } from './upload-session.repository';

describe('UploadSessionRepository', () => {
  let repo: UploadSessionRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();
    repo = module.get(UploadSessionRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('findById는 일치하는 session이 없으면 null을 반환한다', async () => {
    mockDbLimit.mockResolvedValue([]);
    const result = await repo.findById('ghost-id');
    expect(result).toBeNull();
  });

  it('findByIdForUpdate는 FOR UPDATE 절이 적용된 쿼리를 사용한다', async () => {
    mockDbFor.mockResolvedValue([]);
    const result = await repo.findByIdForUpdate('ghost-id');
    expect(result).toBeNull();
  });

  it('deleteById는 일치하는 row가 없으면 false를 반환한다', async () => {
    (mockDatabaseService.db.delete as jest.Mock).mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([]) }),
    });
    const result = await repo.deleteById('ghost-id');
    expect(result).toBe(false);
  });
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { BackupCodeRepository } from './backup-code.repository';

describe('BackupCodeRepository', () => {
  let repo: BackupCodeRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupCodeRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(BackupCodeRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});

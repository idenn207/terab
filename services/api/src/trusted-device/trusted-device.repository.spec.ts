import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext, setupMockDbSelectChain } from '@terab/test';
import { TrustedDeviceRepository } from './trusted-device.repository';

describe('TrustedDeviceRepository', () => {
  let repo: TrustedDeviceRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TrustedDeviceRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get(TrustedDeviceRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });
});

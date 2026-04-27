import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { TrustedDeviceRepository } from './trusted-device.repository';

describe('TrustedDeviceRepository', () => {
  let repo: TrustedDeviceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedDeviceRepository, { provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    repo = module.get(TrustedDeviceRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });
});

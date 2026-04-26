import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { DeviceRepository } from './device.repository';

describe('DeviceRepository', () => {
  let repo: DeviceRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceRepository, { provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    repo = module.get(DeviceRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});

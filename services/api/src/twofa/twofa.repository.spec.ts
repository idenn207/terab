import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { TwoFaRepository } from './twofa.repository';

describe('TwoFaRepository', () => {
  let repo: TwoFaRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TwoFaRepository, { provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    repo = module.get<TwoFaRepository>(TwoFaRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbReturning,
  mockDbUpdate,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
import { InvitationRepository } from './invitation.repository';

describe('InvitationRepository', () => {
  let repo: InvitationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
      ],
    }).compile();

    repo = module.get<InvitationRepository>(InvitationRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain();
    mockDbUpdate.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: mockDbReturning,
        }),
      }),
    });
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('consume', () => {
    it('아직 사용되지 않은 토큰이면 row를 반환한다', async () => {
      mockDbReturning.mockResolvedValue([{ id: 'invitation-id-1' }]);
      const result = await repo.consume('valid-token', 'user-id-1');
      expect(result).toEqual({ id: 'invitation-id-1' });
    });

    it('이미 사용된 토큰이면 null을 반환한다', async () => {
      mockDbReturning.mockResolvedValue([]);
      const result = await repo.consume('used-token', 'user-id-1');
      expect(result).toBeNull();
    });
  });
});

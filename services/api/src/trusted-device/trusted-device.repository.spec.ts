import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import {
  mockDatabaseService,
  mockDbDelete,
  mockDbFrom,
  mockDbSelect,
  mockDbUpdate,
  mockDbWhere,
  mockTransactionContext,
  setupMockDbSelectChain,
} from '@terab/test';
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

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });

  describe('countActiveByUserId', () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    it('활성 행이 없으면 0을 반환한다', async () => {
      mockDbWhere.mockResolvedValue([]);

      const result = await repo.countActiveByUserId('user-id', now);

      expect(result).toBe(0);
    });

    it('count 결과를 number로 정규화해 반환한다 (drizzle은 bigint를 string으로 반환할 수 있음)', async () => {
      mockDbWhere.mockResolvedValue([{ value: '7' }]);

      const result = await repo.countActiveByUserId('user-id', now);

      expect(result).toBe(7);
    });
  });

  describe('deleteOldestByUserId', () => {
    it('deleteCount가 0이면 select·delete를 모두 호출하지 않는다', async () => {
      await repo.deleteOldestByUserId('user-id', 0);

      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it('deleteCount가 음수이면 select·delete를 모두 호출하지 않는다', async () => {
      await repo.deleteOldestByUserId('user-id', -1);

      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it('대상 행이 없으면 delete를 호출하지 않는다', async () => {
      const mockOrderBy = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      mockDbWhere.mockReturnValue({ orderBy: mockOrderBy });

      await repo.deleteOldestByUserId('user-id', 3);

      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it('select된 id들에 대해 delete inArray가 호출된다', async () => {
      const mockOrderBy = jest
        .fn()
        .mockReturnValue({ limit: jest.fn().mockResolvedValue([{ id: 'id-1' }, { id: 'id-2' }]) });
      mockDbWhere.mockReturnValue({ orderBy: mockOrderBy });
      const deleteWhere = jest.fn().mockResolvedValue(undefined);
      mockDbDelete.mockReturnValue({ where: deleteWhere });

      await repo.deleteOldestByUserId('user-id', 2);

      expect(mockDbDelete).toHaveBeenCalled();
      expect(deleteWhere).toHaveBeenCalled();
    });
  });

  describe('refreshExpiresAt', () => {
    it('update.set.where 체인이 호출된다', async () => {
      const updateWhere = jest.fn().mockResolvedValue(undefined);
      mockDbUpdate.mockReturnValue({ set: jest.fn().mockReturnValue({ where: updateWhere }) });

      await repo.refreshExpiresAt('id-1', new Date('2025-02-01T00:00:00.000Z'));

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(updateWhere).toHaveBeenCalled();
    });
  });
});

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

  describe('findAllDeleted', () => {
    it('소프트 삭제된 파일과 폴더를 합쳐 반환한다', async () => {
      const { mockDbWhere } = await import('@terab/test');
      mockDbWhere.mockResolvedValue([]);
      const result = await repo.findAllDeleted('user-1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('cascade 자식 (부모가 휴지통인 항목) 은 LEFT JOIN 필터로 제외 — 빈 결과 mock', async () => {
      const { mockDbWhere, mockDbLeftJoin } = await import('@terab/test');
      mockDbWhere.mockResolvedValue([]);
      await repo.findAllDeleted('user-1');
      // file query 와 folder query 양쪽 모두 leftJoin 호출
      expect(mockDbLeftJoin).toHaveBeenCalled();
    });
  });

  describe('isParentInTrash', () => {
    it('file 의 folder 가 휴지통이면 true', async () => {
      const { mockDbLimit } = await import('@terab/test');
      mockDbLimit.mockResolvedValue([{ parentSoftDeletedAt: new Date() }]);
      const result = await repo.isParentInTrash('f-1', 'file', 'u-1');
      expect(result).toBe(true);
    });

    it('file 의 folder 가 활성이면 false', async () => {
      const { mockDbLimit } = await import('@terab/test');
      mockDbLimit.mockResolvedValue([{ parentSoftDeletedAt: null }]);
      const result = await repo.isParentInTrash('f-1', 'file', 'u-1');
      expect(result).toBe(false);
    });

    it('folder 의 parent 가 휴지통이면 true', async () => {
      const { mockDbLimit } = await import('@terab/test');
      mockDbLimit.mockResolvedValue([{ parentSoftDeletedAt: new Date() }]);
      const result = await repo.isParentInTrash('fd-1', 'folder', 'u-1');
      expect(result).toBe(true);
    });

    it('folder 의 parent 가 활성이면 false', async () => {
      const { mockDbLimit } = await import('@terab/test');
      mockDbLimit.mockResolvedValue([{ parentSoftDeletedAt: null }]);
      const result = await repo.isParentInTrash('fd-1', 'folder', 'u-1');
      expect(result).toBe(false);
    });

    it('항목 자체가 없으면 false (기존 NOT_FOUND 흐름이 처리)', async () => {
      const { mockDbLimit } = await import('@terab/test');
      mockDbLimit.mockResolvedValue([]);
      const result = await repo.isParentInTrash('not-exist', 'file', 'u-1');
      expect(result).toBe(false);
    });
  });
});

import { Test } from '@nestjs/testing';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { RoleService } from '../auth/role/role.service';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

const mockUserRepository = {
  findById: jest.fn(),
  findByUsername: jest.fn(),
  insert: jest.fn(),
};

const mockRoleService = {
  getPermissionsByUserId: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: RoleService, useValue: mockRoleService },
      ],
    }).compile();

    service = module.get(UserService);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('UserRepository.findById에 위임한다', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'user-1' });

      const result = await service.findById('user-1');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('getCurrentUser', () => {
    it('user가 없으면 INVALID_CREDENTIALS 예외', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(service.getCurrentUser('ghost')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('UserDto 형태로 반환한다 — permissions 포함', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'u1',
        username: 'a',
        nickname: 'A',
        password: 'h',
        active: true,
      });
      mockRoleService.getPermissionsByUserId.mockResolvedValue(['file:read', 'user:manage']);
      const result = await service.getCurrentUser('u1');
      expect(mockRoleService.getPermissionsByUserId).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ id: 'u1', username: 'a', nickname: 'A', permissions: ['file:read', 'user:manage'] });
    });
  });
});

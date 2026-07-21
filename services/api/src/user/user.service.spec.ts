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
  listUsers: jest.fn(),
};

const mockRoleService = {
  getPermissionsByUserId: jest.fn(),
  getRoleNamesByUserIds: jest.fn(),
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

  describe('listUsers', () => {
    it('limit/offset 미지정 시 기본값(50/0)으로 repository를 호출한다', async () => {
      mockUserRepository.listUsers.mockResolvedValue({ items: [], total: 0 });
      mockRoleService.getRoleNamesByUserIds.mockResolvedValue(new Map());

      const result = await service.listUsers({});

      expect(mockUserRepository.listUsers).toHaveBeenCalledWith(50, 0);
      expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    });

    it('전달한 limit/offset을 repository에 그대로 위임한다', async () => {
      mockUserRepository.listUsers.mockResolvedValue({ items: [], total: 0 });
      mockRoleService.getRoleNamesByUserIds.mockResolvedValue(new Map());

      await service.listUsers({ limit: 20, offset: 40 });

      expect(mockUserRepository.listUsers).toHaveBeenCalledWith(20, 40);
    });

    it('각 사용자에 RoleService의 role 이름 배열을 결합한다', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      mockUserRepository.listUsers.mockResolvedValue({
        items: [
          { id: 'u1', username: 'admin1', nickname: 'Admin', createdAt },
          { id: 'u2', username: 'user1', nickname: 'User', createdAt },
        ],
        total: 2,
      });
      mockRoleService.getRoleNamesByUserIds.mockResolvedValue(
        new Map([
          ['u1', ['ADMIN', 'USER']],
          ['u2', ['USER']],
        ]),
      );

      const result = await service.listUsers({ limit: 50, offset: 0 });

      expect(mockRoleService.getRoleNamesByUserIds).toHaveBeenCalledWith(['u1', 'u2']);
      expect(result.items).toEqual([
        { id: 'u1', username: 'admin1', nickname: 'Admin', createdAt, roleNames: ['ADMIN', 'USER'] },
        { id: 'u2', username: 'user1', nickname: 'User', createdAt, roleNames: ['USER'] },
      ]);
      expect(result.total).toBe(2);
    });

    it('Map에 없는 userId는 roleNames=[]으로 채운다', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      mockUserRepository.listUsers.mockResolvedValue({
        items: [{ id: 'u1', username: 'a', nickname: 'A', createdAt }],
        total: 1,
      });
      mockRoleService.getRoleNamesByUserIds.mockResolvedValue(new Map());

      const result = await service.listUsers({});

      expect(result.items[0].roleNames).toEqual([]);
    });
  });
});

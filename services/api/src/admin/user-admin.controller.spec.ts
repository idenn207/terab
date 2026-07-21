import { Test } from '@nestjs/testing';
import { UserService } from '../user/user.service';
import { UserAdminController } from './user-admin.controller';

describe('UserAdminController', () => {
  let controller: UserAdminController;
  let service: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserAdminController],
      providers: [
        {
          provide: UserService,
          useValue: {
            listUsers: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UserAdminController);
    service = module.get(UserService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('query를 그대로 UserService.listUsers에 전달하고 결과를 반환한다', async () => {
      const expected = {
        items: [
          { id: 'u1', username: 'admin1', nickname: 'Admin', createdAt: new Date('2026-01-01T00:00:00Z'), roleNames: ['ADMIN'] },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };
      service.listUsers.mockResolvedValue(expected);

      const result = await controller.list({ limit: 10, offset: 0 });

      expect(service.listUsers).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result).toBe(expected);
    });

    it('빈 query도 그대로 위임한다 — 기본값 처리는 service 책임', async () => {
      service.listUsers.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

      await controller.list({});

      expect(service.listUsers).toHaveBeenCalledWith({});
    });
  });
});

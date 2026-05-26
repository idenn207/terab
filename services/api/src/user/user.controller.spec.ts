import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = {
  getCurrentUser: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get(UserController);
    jest.clearAllMocks();
  });

  describe('me', () => {
    it('현재 사용자 정보를 반환한다', async () => {
      mockUserService.getCurrentUser.mockResolvedValue({ id: 'u1', username: 'a', nickname: 'A' });

      const result = await controller.me(mockAuthUser);

      expect(mockUserService.getCurrentUser).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual({ id: 'u1', username: 'a', nickname: 'A' });
    });
  });
});

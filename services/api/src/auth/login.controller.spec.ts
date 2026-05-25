import { Test } from '@nestjs/testing';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

const mockLoginService = {
  register: jest.fn(),
  login: jest.fn(),
  loginWithBackupCode: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
};

describe('UserController', () => {
  let controller: LoginController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LoginController],
      providers: [{ provide: LoginService, useValue: mockLoginService }],
    }).compile();

    controller = module.get(LoginController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('userService.register에 body와 res를 위임한다', async () => {
      const body = { token: 't', username: 'a', nickname: 'A', password: 'p' };
      const res = {} as any;
      mockLoginService.register.mockResolvedValue({ accessToken: 'JWT', user: {}, backupCodes: [] });

      await controller.register(body, res);

      expect(mockLoginService.register).toHaveBeenCalledWith(body, res);
    });
  });

  describe('login', () => {
    it('userService.login에 body/trustToken/userAgent/res를 위임한다', async () => {
      const body = { username: 'a', password: 'p' };
      const res = {} as any;
      mockLoginService.login.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.login(body, 'tt', 'ua', res);

      expect(mockLoginService.login).toHaveBeenCalledWith(body, 'tt', 'ua', res);
    });
  });

  describe('refresh', () => {
    it('cookie에서 refreshToken을 추출해 service에 전달한다', async () => {
      const req = { cookies: { refreshToken: 'rt' } } as any;
      const res = {} as any;
      mockLoginService.refresh.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.refresh(req, res);

      expect(mockLoginService.refresh).toHaveBeenCalledWith('rt', res);
    });

    it('cookie 없을 때 undefined를 전달한다', async () => {
      const req = { cookies: undefined } as any;
      const res = {} as any;
      mockLoginService.refresh.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.refresh(req, res);

      expect(mockLoginService.refresh).toHaveBeenCalledWith(undefined, res);
    });
  });

  describe('logout', () => {
    it('cookie에서 refreshToken을 추출해 service에 전달한다', async () => {
      const req = { cookies: { refreshToken: 'rt' } } as any;
      const res = {} as any;
      mockLoginService.logout.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(mockLoginService.logout).toHaveBeenCalledWith('rt', res);
    });
  });
});

import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

const mockResponse = () => {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

const loginResult = {
  response: LoginResponseDto.authenticated('at.token', new UserResponseDto('uid', 'user1', 'User')),
  rawRefreshToken: 'raw.rt',
  refreshTokenExpMs: 604800000,
};

const mockAuthService = {
  login: jest.fn().mockResolvedValue(loginResult),
  loginWithBackupCode: jest.fn().mockResolvedValue(loginResult),
  refresh: jest.fn().mockResolvedValue(loginResult),
  logout: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockResolvedValue(new UserResponseDto('uid', 'user1', 'User')),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('POST /login — RT 쿠키를 설정하고 LoginResponseDto를 반환한다', async () => {
    const res = mockResponse();
    const result = await controller.login({ username: 'u', password: 'p' } as any, undefined, undefined, res);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'raw.rt', expect.objectContaining({ httpOnly: true }));
    expect(result.status).toBe('AUTHENTICATED');
  });

  it('POST /logout — RT 쿠키를 삭제한다', async () => {
    const res = mockResponse();
    const mockReq = { cookies: { refreshToken: 'raw.rt' } } as any;
    await controller.logout(mockReq, res);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ path: '/api/auth' }));
  });

  it('GET /me — UserResponseDto를 반환한다', async () => {
    const result = await controller.me({
      userId: 'uid',
      username: 'user1',
      permissions: [],
    });
    expect(result.id).toBe('uid');
  });
});

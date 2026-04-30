import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser, mockUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const authenticatedResult = {
  response: { status: 'AUTHENTICATED' as const, accessToken: 'at.token', user: mockUser },
  rawRefreshToken: 'raw.rt',
  refreshTokenExpMs: 604800000,
};

const mockAuthService = {
  register: jest.fn().mockResolvedValue({
    accessToken: 'at.token',
    user: mockAuthUser,
    backupCodes: ['code1', 'code2'],
    rawRefreshToken: 'raw.rt',
    refreshTokenExpMs: 604800000,
  }),
  login: jest.fn().mockResolvedValue(authenticatedResult),
  loginWithBackupCode: jest.fn().mockResolvedValue(authenticatedResult),
  completeTwoFa: jest.fn().mockResolvedValue(authenticatedResult),
  refresh: jest.fn().mockResolvedValue(authenticatedResult),
  logout: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockResolvedValue(mockUser),
};

describe('AuthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('POST /auth/login — RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user1', password: 'pass' })
      .expect(HttpStatus.OK);

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/refreshToken=raw.rt;/)]));
    expect(res.body.status).toBe('AUTHENTICATED');
    expect(res.body.accessToken).toBe('at.token');
  });

  it('POST /auth/logout — RT 쿠키를 삭제하고 204를 반환한다', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout').send({}).expect(HttpStatus.NO_CONTENT);

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(res.get('Set-Cookie')).toEqual(expect.arrayContaining([expect.stringMatching(/refreshToken=;/)]));
  });

  it('POST /auth/2fa/challenge/:id/complete — RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
    const challengeId = 'challenge-id';
    const res = await request(app.getHttpServer())
      .post(`/auth/2fa/challenge/${challengeId}/complete`)
      .send({})
      .expect(HttpStatus.OK);

    expect(mockAuthService.completeTwoFa).toHaveBeenCalledWith(challengeId);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/refreshToken=raw.rt/)]));
    expect(res.body.status).toBe('AUTHENTICATED');
  });

  it('GET /auth/me — 현재 사용자를 반환한다', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').expect(HttpStatus.OK);

    expect(res.body.id).toBe(mockUser.id);
  });
});

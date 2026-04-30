import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { TwoFaController } from './twofa.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
};

describe('TwoFaController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [TwoFaController],
      providers: [
        { provide: TwoFaService, useValue: mockTwoFaService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockAuthUser;
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

  it('GET /auth/2fa/challenge/:id/status ── PENDING 상태를 반환한다', async () => {
    const challengeId = 'challenge-id';
    const pendingStatus = {
      status: 'PENDING' as const,
      options: ['47', '82', '13'],
      correctNum: '47',
      remainingSeconds: 55,
    };
    mockTwoFaService.getStatus.mockResolvedValue(pendingStatus);

    const res = await request(app.getHttpServer()).get(`/auth/2fa/challenge/${challengeId}/status`).expect(200);

    expect(mockTwoFaService.getStatus).toHaveBeenCalledWith(challengeId);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.correctNum).toBe('47');
  });

  it('POST /auth/2fa/challenge/:id/respond ── 204를 반환한다', async () => {
    const challengeId = 'challenge-id';
    mockTwoFaService.respond.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post(`/auth/2fa/challenge/${challengeId}/respond`)
      .send({ selectedNumber: '47' })
      .expect(204);

    expect(mockTwoFaService.respond).toHaveBeenCalledWith(challengeId, mockAuthUser.userId, '47');
  });

  it('POST /auth/2fa/challenge/:id/resend ── TwoFaService.resend 결과를 반환한다', async () => {
    const newChallengeId = 'new-challenge-id';
    const resendResult = {
      id: newChallengeId,
      options: ['47', '82', '13'],
      expiresAt: new Date(),
    };
    mockTwoFaService.resend.mockResolvedValue(resendResult);

    const res = await request(app.getHttpServer()) //
      .post('/auth/2fa/challenge/old-id/resend')
      .send({})
      .expect(200);

    expect(res.body.challengeId).toBe('new-challenge-id');
  });
});

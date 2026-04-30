import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceService } from './trusted-device.service';

const mockTrustedDeviceService = {
  findAll: jest.fn(),
  register: jest.fn(),
  revoke: jest.fn(),
  trustDurationMs: 2592000000,
};

describe('TrustedDeviceController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [TrustedDeviceController],
      providers: [
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
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

  it('GET /trusted-device — 목록을 반환한다', async () => {
    const trustedDeviceId = 'td-1';
    const devices = [{ id: trustedDeviceId, userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
    mockTrustedDeviceService.findAll.mockResolvedValue(devices);

    const res = await request(app.getHttpServer()).get('/trusted-device').expect(200);

    expect(mockTrustedDeviceService.findAll).toHaveBeenCalledWith(mockAuthUser.userId);
    expect(res.body[0].id).toBe(trustedDeviceId);
  });

  it('POST /trusted-device — trustToken 쿠키를 설정하고 201을 반환한다', async () => {
    mockTrustedDeviceService.register.mockResolvedValue('raw-trust-token');

    const res = await request(app.getHttpServer())
      .post('/trusted-device')
      .set('user-agent', 'Mozilla/5.0')
      .send({})
      .expect(201);

    expect(mockTrustedDeviceService.register).toHaveBeenCalledWith(mockAuthUser.userId, expect.any(String));
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/trustToken=raw-trust-token;/)]),
    );
  });

  it('DELETE /trusted-device/:id — 204를 반환한다', async () => {
    const trustedDeviceId = randomUUID();
    mockTrustedDeviceService.revoke.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete(`/trusted-device/${trustedDeviceId}`).expect(204);

    expect(mockTrustedDeviceService.revoke).toHaveBeenCalledWith(trustedDeviceId, mockAuthUser.userId);
  });
});

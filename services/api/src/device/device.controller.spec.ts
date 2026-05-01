import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

const mockDeviceService = {
  register: jest.fn(),
  findAll: jest.fn(),
  remove: jest.fn(),
};

describe('DeviceController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [DeviceController],
      providers: [
        { provide: DeviceService, useValue: mockDeviceService },
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

  it('POST /devices — 디바이스를 등록하고 204를 반환한다', async () => {
    const pushToken = 'push-token-value';
    mockDeviceService.register.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/devices')
      .set('User-Agent', 'Mozilla/5.0')
      .send({ pushToken: pushToken })
      .expect(204);

    expect(mockDeviceService.register).toHaveBeenCalledWith(mockAuthUser.userId, pushToken, expect.any(String));
  });

  it('GET /devices — 디바이스 목록을 반환한다', async () => {
    const devices = [{ id: 'dev-1', userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
    mockDeviceService.findAll.mockResolvedValue(devices);

    const res = await request(app.getHttpServer()).get('/devices').expect(200);

    expect(mockDeviceService.findAll).toHaveBeenCalledWith(mockAuthUser.userId);
    expect(res.body[0].id).toBe('dev-1');
  });

  it('DELETE /devices/:id — 디바이스를 삭제하고 204를 반환한다', async () => {
    const deviceId = randomUUID();
    mockDeviceService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete(`/devices/${deviceId}`).expect(204);

    expect(mockDeviceService.remove).toHaveBeenCalledWith(deviceId, mockAuthUser.userId);
  });
});

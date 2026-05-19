import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser } from '@terab/test';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceService } from './trusted-device.service';

describe('TrustedDeviceController', () => {
  let controller: TrustedDeviceController;
  let service: jest.Mocked<TrustedDeviceService>;

  const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrustedDeviceController],
      providers: [
        {
          provide: TrustedDeviceService,
          useValue: {
            list: jest.fn(),
            register: jest.fn(),
            revoke: jest.fn(),
            trustDurationMs: TRUST_DURATION_MS,
          },
        },
      ],
    }).compile();

    controller = module.get(TrustedDeviceController);
    service = module.get(TrustedDeviceService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('등록된 신뢰기기가 없으면 빈 배열을 반환한다', async () => {
      service.list.mockResolvedValue([]);

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual([]);
    });

    it('등록된 신뢰기기 목록을 반환한다', async () => {
      const devices = [{ id: randomUUID(), userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
      service.list.mockResolvedValue(devices);

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual(devices);
    });
  });

  describe('register', () => {
    it('service.register를 호출하고 trustToken 쿠키를 설정한다', async () => {
      const rawToken = 'raw-trust-token';
      service.register.mockResolvedValue(rawToken);
      const res = { cookie: jest.fn() } as unknown as Response;

      const result = await controller.register(mockAuthUser, 'Mozilla/5.0', res);

      expect(service.register).toHaveBeenCalledWith(mockAuthUser.userId, 'Mozilla/5.0');
      expect(res.cookie).toHaveBeenCalledWith(
        'trustToken',
        rawToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: TRUST_DURATION_MS,
          path: '/',
        }),
      );
      expect(result).toBeUndefined();
    });

    it('user-agent 헤더가 없어도 정상 처리한다', async () => {
      service.register.mockResolvedValue('raw-token');
      const res = { cookie: jest.fn() } as unknown as Response;

      await controller.register(mockAuthUser, undefined, res);

      expect(service.register).toHaveBeenCalledWith(mockAuthUser.userId, undefined);
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('service.revoke에서 TRUSTED_DEVICE_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.revoke.mockRejectedValue(new ApiException('TRUSTED_DEVICE_NOT_FOUND'));
      const id = randomUUID();

      await expect(controller.revoke(mockAuthUser, id)).rejects.toThrow(ApiException);
      await expect(controller.revoke(mockAuthUser, id)).rejects.toMatchObject({
        code: 'TRUSTED_DEVICE_NOT_FOUND',
      });
    });

    it('id, userId 순서로 service.revoke를 호출한다', async () => {
      service.revoke.mockResolvedValue(undefined);
      const id = randomUUID();

      await controller.revoke(mockAuthUser, id);

      expect(service.revoke).toHaveBeenCalledWith(id, mockAuthUser.userId);
    });
  });
});

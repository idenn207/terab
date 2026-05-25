import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser } from '@terab/test';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceService } from './trusted-device.service';

const mockAuthService = { setTrustCookie: jest.fn() };
const mockTrustedDeviceService = {
  list: jest.fn(),
  register: jest.fn(),
  revoke: jest.fn(),
};

describe('TrustedDeviceController', () => {
  let controller: TrustedDeviceController;
  let service: jest.Mocked<TrustedDeviceService>;

  const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrustedDeviceController],
      providers: [
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get(TrustedDeviceController);
    service = module.get(TrustedDeviceService);
    jest.clearAllMocks();
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
    it('신뢰기기 등록 후 AuthService.setTrustCookie를 호출한다', async () => {
      mockTrustedDeviceService.register.mockResolvedValue('raw-tt');
      Object.defineProperty(mockTrustedDeviceService, 'trustDurationMs', { value: 30 * 24 * 60 * 60 * 1000 });
      const res = {} as any;

      await controller.register(mockAuthUser, 'UA-1', res);

      expect(mockTrustedDeviceService.register).toHaveBeenCalledWith(mockAuthUser.userId, 'UA-1');
      expect(mockAuthService.setTrustCookie).toHaveBeenCalledWith(res, 'raw-tt', 30 * 24 * 60 * 60 * 1000);
    });

    it('user-agent 헤더가 없어도 정상 처리한다', async () => {
      service.register.mockResolvedValue('raw-token');
      Object.defineProperty(mockTrustedDeviceService, 'trustDurationMs', { value: TRUST_DURATION_MS });
      const res = {} as Response;

      await controller.register(mockAuthUser, undefined, res);

      expect(service.register).toHaveBeenCalledWith(mockAuthUser.userId, undefined);
      expect(mockAuthService.setTrustCookie).toHaveBeenCalledWith(res, 'raw-token', TRUST_DURATION_MS);
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

import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser } from '@terab/test';
import { randomUUID } from 'node:crypto';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

describe('DeviceController', () => {
  let controller: DeviceController;
  let service: jest.Mocked<DeviceService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeviceController],
      providers: [
        {
          provide: DeviceService,
          useValue: {
            list: jest.fn(),
            register: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(DeviceController);
    service = module.get(DeviceService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('등록된 디바이스가 없으면 빈 배열을 반환한다', async () => {
      service.list.mockResolvedValue([]);

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual([]);
    });

    it('등록된 디바이스 목록을 반환한다', async () => {
      const devices = [{ id: randomUUID(), userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
      service.list.mockResolvedValue(devices);

      const result = await controller.list(mockAuthUser);

      expect(service.list).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual(devices);
    });
  });

  describe('register', () => {
    it('user-agent 헤더가 없어도 정상 처리한다', async () => {
      service.register.mockResolvedValue(undefined);

      await controller.register(mockAuthUser, { pushToken: 'push-token-value' }, undefined);

      expect(service.register).toHaveBeenCalledWith(mockAuthUser.userId, 'push-token-value', undefined);
    });

    it('userId, pushToken, userAgent 순서로 service.register를 호출한다', async () => {
      service.register.mockResolvedValue(undefined);

      await controller.register(mockAuthUser, { pushToken: 'push-token-value' }, 'Mozilla/5.0');

      expect(service.register).toHaveBeenCalledWith(mockAuthUser.userId, 'push-token-value', 'Mozilla/5.0');
    });
  });

  describe('remove', () => {
    it('service.remove에서 DEVICE_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.remove.mockRejectedValue(new ApiException('DEVICE_NOT_FOUND'));
      const id = randomUUID();

      await expect(controller.remove(mockAuthUser, id)).rejects.toThrow(ApiException);
      await expect(controller.remove(mockAuthUser, id)).rejects.toMatchObject({
        code: 'DEVICE_NOT_FOUND',
      });
    });

    it('id, userId 순서로 service.remove를 호출한다', async () => {
      service.remove.mockResolvedValue(undefined);
      const id = randomUUID();

      await controller.remove(mockAuthUser, id);

      expect(service.remove).toHaveBeenCalledWith(id, mockAuthUser.userId);
    });
  });
});

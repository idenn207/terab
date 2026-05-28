import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

const mockDeviceRepository = {
  upsert: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
  deleteByUserIdAndPushToken: jest.fn(),
};

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: DeviceRepository, useValue: mockDeviceRepository },
      ],
    }).compile();
    service = module.get(DeviceService);
    jest.clearAllMocks();
  });

  describe('remove', () => {
    it('디바이스가 없으면 ApiException(DEVICE_NOT_FOUND)을 던진다', async () => {
      mockDeviceRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.remove('device-id', 'user-id')).rejects.toThrow(ApiException);
    });

    it('디바이스가 있으면 deleteById를 호출한다', async () => {
      mockDeviceRepository.findByIdAndUserId.mockResolvedValue({ id: 'device-id' });

      await service.remove('device-id', 'user-id');

      expect(mockDeviceRepository.deleteById).toHaveBeenCalledWith('device-id');
    });
  });

  describe('deactivateByPushToken', () => {
    it('userId 와 pushToken 이 모두 일치하는 device 만 hard delete한다', async () => {
      await service.deactivateByPushToken('user-id', 'token-abc');

      expect(mockDeviceRepository.deleteByUserIdAndPushToken).toHaveBeenCalledWith('user-id', 'token-abc');
    });
  });
});

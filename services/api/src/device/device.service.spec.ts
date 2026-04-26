import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

const mockDeviceRepository = {
  upsert: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
};

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceService, { provide: DeviceRepository, useValue: mockDeviceRepository }],
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
});

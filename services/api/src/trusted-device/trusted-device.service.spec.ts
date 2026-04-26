import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceService } from './trusted-device.service';

const mockRepo = {
  insert: jest.fn(),
  findByTokenHash: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
};

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedDeviceService, { provide: TrustedDeviceRepository, useValue: mockRepo }],
    }).compile();

    service = module.get<TrustedDeviceService>(TrustedDeviceService);
    jest.clearAllMocks();
  });

  describe('verify', () => {
    it('토큰이 없으면 false를 반환한다', async () => {
      const result = await service.verify(undefined, 'user-id');
      expect(result).toBe(false);
    });

    it('DB에 토큰이 없으면 false를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue(null);
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('만료된 토큰이면 false를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('유효한 토큰이고 userId가 일치하면 true를 반환한다', async () => {
      mockRepo.findByTokenHash.mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 100_000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(true);
    });
  });

  describe('revoke', () => {
    it('디바이스가 없으면 ApiException(TRUSTED_DEVICE_NOT_FOUND)을 던진다', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);
      await expect(service.revoke('device-id', 'user-id')).rejects.toThrow(ApiException);
    });
  });
});

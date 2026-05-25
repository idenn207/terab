import { Test, TestingModule } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { TokenService } from '@terab/security';
import { mockDatabaseService, mockTransactionContext, setupMockDbTransactionChain } from '@terab/test';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceService } from './trusted-device.service';

const mockTrustedDeviceRepository = {
  insert: jest.fn(),
  findByTokenHash: jest.fn(),
  findByUserId: jest.fn(),
  findByIdAndUserId: jest.fn(),
  deleteById: jest.fn(),
  countActiveByUserId: jest.fn(),
  deleteOldestByUserId: jest.fn(),
  refreshExpiresAt: jest.fn(),
};

const mockTokenService = {
  hashToken: jest.fn(),
};

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustedDeviceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TrustedDeviceRepository, useValue: mockTrustedDeviceRepository },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<TrustedDeviceService>(TrustedDeviceService);
    jest.clearAllMocks();
    setupMockDbTransactionChain();
  });

  describe('verify', () => {
    it('토큰이 없으면 false를 반환한다', async () => {
      const result = await service.verify(undefined, 'user-id');
      expect(result).toBe(false);
    });

    it('DB에 토큰이 없으면 false를 반환한다', async () => {
      mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue(null);
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('만료된 토큰이면 false를 반환한다', async () => {
      mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(false);
    });

    it('유효한 토큰이고 userId가 일치하면 true를 반환한다', async () => {
      mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
        id: 'device-1',
        userId: 'user-id',
        createdAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 100_000),
      });
      const result = await service.verify('raw-token', 'user-id');
      expect(result).toBe(true);
    });

    describe('sliding expiry', () => {
      const DAY = 24 * 60 * 60 * 1000;

      it('hard cap에 여유가 있으면 expiresAt을 now + 30일로 갱신한다', async () => {
        const now = new Date('2025-01-15T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(now);
        try {
          mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
            id: 'device-1',
            userId: 'user-id',
            createdAt: new Date('2025-01-10T00:00:00.000Z'), // 5일 전 → cap 여유
            expiresAt: new Date('2025-01-20T00:00:00.000Z'), // 5일 후
          });

          await service.verify('raw-token', 'user-id');

          expect(mockTrustedDeviceRepository.refreshExpiresAt).toHaveBeenCalledWith(
            'device-1',
            new Date(now.getTime() + 30 * DAY),
          );
        } finally {
          jest.useRealTimers();
        }
      });

      it('now + 30일이 hard cap(createdAt + 90일)을 넘으면 cap 값으로 갱신한다', async () => {
        const createdAt = new Date('2025-01-01T00:00:00.000Z');
        const now = new Date('2025-03-15T00:00:00.000Z'); // createdAt + 73일
        jest.useFakeTimers().setSystemTime(now);
        try {
          mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
            id: 'device-1',
            userId: 'user-id',
            createdAt,
            expiresAt: new Date('2025-03-30T00:00:00.000Z'), // 미래, but cap(2025-04-01)보다 작음
          });

          await service.verify('raw-token', 'user-id');

          expect(mockTrustedDeviceRepository.refreshExpiresAt).toHaveBeenCalledWith(
            'device-1',
            new Date(createdAt.getTime() + 90 * DAY),
          );
        } finally {
          jest.useRealTimers();
        }
      });

      it('이미 hard cap에 도달해 새 값이 현재 expiresAt보다 크지 않으면 refresh를 호출하지 않는다', async () => {
        const createdAt = new Date('2025-01-01T00:00:00.000Z');
        const now = new Date('2025-03-31T00:00:00.000Z');
        const capAt = new Date(createdAt.getTime() + 90 * DAY);
        jest.useFakeTimers().setSystemTime(now);
        try {
          mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
            id: 'device-1',
            userId: 'user-id',
            createdAt,
            expiresAt: capAt, // 이미 cap에 도달
          });

          await service.verify('raw-token', 'user-id');

          expect(mockTrustedDeviceRepository.refreshExpiresAt).not.toHaveBeenCalled();
        } finally {
          jest.useRealTimers();
        }
      });

      it('만료된 토큰이면 refresh를 호출하지 않는다 (이미 false 반환 경로)', async () => {
        mockTrustedDeviceRepository.findByTokenHash.mockResolvedValue({
          id: 'device-1',
          userId: 'user-id',
          createdAt: new Date(Date.now() - 100_000),
          expiresAt: new Date(Date.now() - 1000),
        });

        await service.verify('raw-token', 'user-id');

        expect(mockTrustedDeviceRepository.refreshExpiresAt).not.toHaveBeenCalled();
      });
    });
  });

  describe('revoke', () => {
    it('디바이스가 없으면 ApiException(TRUSTED_DEVICE_NOT_FOUND)을 던진다', async () => {
      mockTrustedDeviceRepository.findByIdAndUserId.mockResolvedValue(null);
      await expect(service.revoke('device-id', 'user-id')).rejects.toThrow(ApiException);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      mockTokenService.hashToken.mockReturnValue('hashed-token');
      mockTrustedDeviceRepository.insert.mockResolvedValue(undefined);
      mockTrustedDeviceRepository.deleteOldestByUserId.mockResolvedValue(undefined);
    });

    it('활성 trust가 MAX-1(=9) 이하면 trim 호출 없이 곧장 insert한다', async () => {
      mockTrustedDeviceRepository.countActiveByUserId.mockResolvedValue(9);

      await service.register('user-id', 'ua');

      expect(mockTrustedDeviceRepository.deleteOldestByUserId).not.toHaveBeenCalled();
      expect(mockTrustedDeviceRepository.insert).toHaveBeenCalledTimes(1);
    });

    it('활성 trust가 정확히 MAX(=10)이면 가장 오래된 1대를 폐기한 뒤 insert한다', async () => {
      mockTrustedDeviceRepository.countActiveByUserId.mockResolvedValue(10);

      await service.register('user-id', 'ua');

      expect(mockTrustedDeviceRepository.deleteOldestByUserId).toHaveBeenCalledWith('user-id', 1);
      expect(mockTrustedDeviceRepository.insert).toHaveBeenCalledTimes(1);
    });

    it('활성 trust가 MAX보다 많으면(예: 12) 신규 자리를 포함해 정확히 active - (MAX - 1)대를 폐기한다', async () => {
      mockTrustedDeviceRepository.countActiveByUserId.mockResolvedValue(12);

      await service.register('user-id', 'ua');

      expect(mockTrustedDeviceRepository.deleteOldestByUserId).toHaveBeenCalledWith('user-id', 3);
    });

    it('insert 실패가 발생하면 예외가 전파된다 (트랜잭션 롤백 위임)', async () => {
      mockTrustedDeviceRepository.countActiveByUserId.mockResolvedValue(0);
      mockTrustedDeviceRepository.insert.mockRejectedValue(new Error('db error'));

      await expect(service.register('user-id', 'ua')).rejects.toThrow('db error');
    });
  });
});

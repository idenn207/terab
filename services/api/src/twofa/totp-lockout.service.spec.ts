import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { TotpLockoutService } from './totp-lockout.service';

describe('TotpLockoutService', () => {
  let service: TotpLockoutService;
  const store = new Map<string, { value: number; expiresAt: number }>();
  const mockCache = {
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    }),
    set: jest.fn(async (key: string, value: number, ttl: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttl });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TotpLockoutService, { provide: CACHE_MANAGER, useValue: mockCache }],
    }).compile();
    service = module.get(TotpLockoutService);
    store.clear();
    jest.clearAllMocks();
  });

  describe('recordFailure', () => {
    it('실패 카운트를 1씩 증가시키고 ttl 갱신', async () => {
      await service.recordFailure('user-1');
      await service.recordFailure('user-1');
      expect(await service.getFailureCount('user-1')).toBe(2);
    });
  });

  describe('isLocked', () => {
    it('실패가 한도 미만이면 false', async () => {
      for (let i = 0; i < 4; i++) await service.recordFailure('user-1');
      expect(await service.isLocked('user-1')).toBe(false);
    });

    it('실패가 5회면 true', async () => {
      for (let i = 0; i < 5; i++) await service.recordFailure('user-1');
      expect(await service.isLocked('user-1')).toBe(true);
    });
  });

  describe('clearLockout', () => {
    it('성공 시 카운트가 0이 된다', async () => {
      await service.recordFailure('user-1');
      await service.clearLockout('user-1');
      expect(await service.getFailureCount('user-1')).toBe(0);
    });
  });
});

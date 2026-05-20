import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { TWOFA_STRATEGY_TOKEN, TwoFaStrategy } from './twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './twofa-strategy.registry';

const makeMockStrategy = (type: string): jest.Mocked<TwoFaStrategy> => ({
  type: type as TwoFaStrategy['type'],
  startSetup: jest.fn(),
  completeSetup: jest.fn(),
  createChallenge: jest.fn(),
  verifyResponse: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
});

describe('TwoFaStrategyRegistry', () => {
  describe('get', () => {
    it('등록된 type이면 해당 strategy를 반환한다', async () => {
      const push = makeMockStrategy('PUSH');
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [push] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(registry.get('PUSH')).toBe(push);
    });

    it('미등록 type이면 TWO_FA_STRATEGY_NOT_FOUND를 던진다', async () => {
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(() => registry.get('TOTP')).toThrow(ApiException);
      expect(() => registry.get('TOTP')).toThrow(new ApiException('TWO_FA_STRATEGY_NOT_FOUND'));
    });

    it('같은 type 중복 등록 시 마지막 등록을 우선한다', async () => {
      const first = makeMockStrategy('PUSH');
      const second = makeMockStrategy('PUSH');
      const module = await Test.createTestingModule({
        providers: [TwoFaStrategyRegistry, { provide: TWOFA_STRATEGY_TOKEN, useValue: [first, second] }],
      }).compile();
      const registry = module.get(TwoFaStrategyRegistry);

      expect(registry.get('PUSH')).toBe(second);
    });
  });
});

import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { TWOFA_STRATEGY_TOKEN, TwoFaStrategy, TwoFaStrategyType } from './twofa-strategy.interface';

@Injectable()
export class TwoFaStrategyRegistry {
  private readonly map: Map<TwoFaStrategyType, TwoFaStrategy>;

  constructor(@Inject(TWOFA_STRATEGY_TOKEN) strategies: TwoFaStrategy[]) {
    this.map = new Map();
    for (const s of strategies) {
      this.map.set(s.type, s);
    }
  }

  get(type: TwoFaStrategyType): TwoFaStrategy {
    const strategy = this.map.get(type);
    if (!strategy) throw new ApiException('TWO_FA_STRATEGY_NOT_FOUND');
    return strategy;
  }
}

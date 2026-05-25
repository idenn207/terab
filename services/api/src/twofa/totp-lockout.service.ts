import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TotpLockoutService {
  private readonly MAX_FAILURES = 5;
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly KEY_PREFIX = 'twofa:totp:fail:';

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getFailureCount(userId: string): Promise<number> {
    const value = await this.cache.get<number>(this.key(userId));
    return value ?? 0;
  }

  async isLocked(userId: string): Promise<boolean> {
    return (await this.getFailureCount(userId)) >= this.MAX_FAILURES;
  }

  async recordFailure(userId: string): Promise<void> {
    const next = (await this.getFailureCount(userId)) + 1;
    await this.cache.set(this.key(userId), next, this.TTL_MS);
  }

  async clearLockout(userId: string): Promise<void> {
    await this.cache.del(this.key(userId));
  }

  private key(userId: string): string {
    return `${this.KEY_PREFIX}${userId}`;
  }
}

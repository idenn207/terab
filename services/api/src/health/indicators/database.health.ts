import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { DatabaseService } from '@terab/db';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly db: DatabaseService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.db.ping();
      return indicator.up();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      return indicator.down({ message });
    }
  }
}

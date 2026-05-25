import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleQueryLogger } from '@terab/logger';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Pool } from 'pg';
import * as schema from './schema';
import { OwnerSeeder, RbacSeeder } from './seed';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly queryLogger: DrizzleQueryLogger,
    private readonly rbacSeeder: RbacSeeder,
    private readonly ownerSeeder: OwnerSeeder,
  ) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
      max: 5,
      idleTimeoutMillis: 60000,
    });
    this.db = drizzle(this.pool, { schema, casing: 'snake_case', logger: this.queryLogger });
  }

  async onModuleInit(): Promise<void> {
    const migrationsFolder = join(__dirname, '../..', 'drizzle');
    // DB 컨테이너 준비 전 API가 먼저 시작될 수 있어 재시도 처리
    const maxRetries = 10;
    const retryDelayMs = 3000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await migrate(this.db, { migrationsFolder });
        await this.seed();
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  private async seed(): Promise<void> {
    // OwnerSeeder는 RbacSeeder가 OWNER role을 먼저 보장한 뒤 실행돼야 함
    await this.rbacSeeder.seed(this.db);
    await this.ownerSeeder.seed(this.db);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

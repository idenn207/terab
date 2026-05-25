import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '@terab/security';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

@Injectable()
export class OwnerSeeder {
  private readonly BCRYPT_ROUNDS = 10;
  private readonly DEFAULT_USERNAME = 'owner';
  private readonly DEFAULT_NICKNAME = 'Owner';
  private readonly UNIQUE_VIOLATION = '23505';

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async seed(db: NodePgDatabase<typeof schema>): Promise<void> {
    const ownerPassword = this.configService.get<string>('OWNER_PASSWORD');
    if (!ownerPassword) return;

    const ownerUsername = this.configService.get<string>('OWNER_USERNAME') ?? this.DEFAULT_USERNAME;
    const ownerNickname = this.configService.get<string>('OWNER_NICKNAME') ?? this.DEFAULT_NICKNAME;

    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, ownerUsername))
      .limit(1);
    if (existing) return;

    const [ownerRole] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.name, 'OWNER'))
      .limit(1);
    if (!ownerRole) {
      throw new Error('OWNER role 없음 — 마이그레이션·RBAC seed 실행 여부를 확인하세요');
    }

    const hashed = await bcrypt.hash(this.tokenService.pepperPassword(ownerPassword), this.BCRYPT_ROUNDS);

    try {
      const [created] = await db
        .insert(schema.users)
        .values({ username: ownerUsername, nickname: ownerNickname, password: hashed })
        .returning({ id: schema.users.id });
      if (!created) return;
      await db.insert(schema.userRoles).values({ userId: created.id, roleId: ownerRole.id });
    } catch (err) {
      // 동시 기동 시 UNIQUE 충돌은 다른 인스턴스가 먼저 owner를 생성한 정상 케이스
      if ((err as { code?: string }).code !== this.UNIQUE_VIOLATION) throw err;
    }
  }
}

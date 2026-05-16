import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, invitations, users } from '@terab/db';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e) — register invitation 롤백', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;

  // 테스트마다 격리된 데이터를 위해 고유 username/token 사용
  const testUsername = `rollback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let testToken: string;
  let ownerUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = moduleFixture.get(DatabaseService);

    // owner 계정은 AppModule 초기화 시 자동 생성됨 (initOwnerAccount)
    const [ownerRow] = await db.db.select({ id: users.id }).from(users).where(eq(users.username, 'owner'));
    if (!ownerRow) {
      throw new Error(
        'owner 계정이 없습니다. e2e는 OWNER_PASSWORD 환경변수가 설정된 상태에서 AppModule이 부팅되어 owner 계정이 생성되어야 합니다.',
      );
    }
    ownerUserId = ownerRow.id;

    // 1. 테스트용 invitation 생성 (직접 DB insert)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [row] = await db.db
      .insert(invitations)
      .values({ createdBy: ownerUserId, expiresAt })
      .returning({ token: invitations.token });
    if (!row) throw new Error('테스트용 invitation 생성 실패');
    testToken = row.token;

    // 2. invitation을 미리 소비 처리 (다른 사용자가 사용한 것처럼 시뮬레이션)
    await db.db
      .update(invitations)
      .set({ usedAt: new Date(), usedBy: ownerUserId })
      .where(eq(invitations.token, testToken));
  });

  afterAll(async () => {
    // cleanup: 생성된 invitation/user 제거
    await db.db.delete(users).where(eq(users.username, testUsername));
    await db.db.delete(invitations).where(eq(invitations.token, testToken));
    await app.close();
  });

  it('이미 사용된 invitation 토큰으로 register 시도 시 409 CONFLICT를 반환하고 users 테이블에 row가 생성되지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        token: testToken,
        username: testUsername,
        nickname: 'rollback',
        password: 'Password1234!',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITATION_ALREADY_USED');

    // users 테이블에 해당 username row가 없어야 한다 (Phase 3에서 보장됨)
    const found = await db.db.select().from(users).where(eq(users.username, testUsername));
    expect(found).toEqual([]);
  });
});

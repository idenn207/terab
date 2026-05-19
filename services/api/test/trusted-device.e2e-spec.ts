import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, trustedDevices, users } from '@terab/db';
import { TokenService } from '@terab/security';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { TrustedDeviceService } from '../src/trusted-device/trusted-device.service';

describe('TrustedDevice (e2e) — trim / sliding / hard cap', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let service: TrustedDeviceService;
  let tokenService: TokenService;
  let ownerUserId: string;

  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DatabaseService);
    service = app.get(TrustedDeviceService);
    tokenService = app.get(TokenService);

    const [row] = await db.db.select({ id: users.id }).from(users).where(eq(users.username, 'owner'));
    if (!row) {
      throw new Error(
        'owner 계정이 없습니다. OWNER_PASSWORD 환경변수가 설정된 상태에서 AppModule이 부팅돼 owner 계정이 생성돼야 합니다.',
      );
    }
    ownerUserId = row.id;
  });

  afterAll(async () => {
    if (db) await db.db.delete(trustedDevices).where(eq(trustedDevices.userId, ownerUserId));
    if (app) await app.close();
  });

  beforeEach(async () => {
    await db.db.delete(trustedDevices).where(eq(trustedDevices.userId, ownerUserId));
  });

  describe('trim (MAX_TRUST_PER_USER = 10)', () => {
    it('11번째 등록 시 가장 오래된 trust가 폐기되어 활성 trust 개수는 10대로 유지된다', async () => {
      for (let i = 0; i < 11; i++) {
        await service.register(ownerUserId, `ua-${i}`);
        // createdAt(default now())이 동일 ms로 찍히면 정렬이 흔들리므로 ms 단위 간격 확보
        await new Promise((r) => setTimeout(r, 5));
      }

      const rows = await db.db
        .select({ userAgent: trustedDevices.userAgent, createdAt: trustedDevices.createdAt })
        .from(trustedDevices)
        .where(eq(trustedDevices.userId, ownerUserId));

      expect(rows.length).toBe(10);
      // 가장 처음 등록된 ua-0이 폐기되었어야 한다
      expect(rows.find((r) => r.userAgent === 'ua-0')).toBeUndefined();
      // 최신 등록인 ua-10은 남아 있어야 한다
      expect(rows.find((r) => r.userAgent === 'ua-10')).toBeDefined();
    });

    it('10대 정원 안에서 등록은 trim 없이 모두 보존된다', async () => {
      for (let i = 0; i < 10; i++) {
        await service.register(ownerUserId, `ua-${i}`);
        await new Promise((r) => setTimeout(r, 2));
      }

      const rows = await db.db
        .select({ userAgent: trustedDevices.userAgent })
        .from(trustedDevices)
        .where(eq(trustedDevices.userId, ownerUserId));

      expect(rows.length).toBe(10);
      expect(rows.find((r) => r.userAgent === 'ua-0')).toBeDefined();
      expect(rows.find((r) => r.userAgent === 'ua-9')).toBeDefined();
    });
  });

  describe('sliding expiry', () => {
    it('verify 성공 시 expiresAt이 sliding으로 연장된다 (now + 30일에 근사)', async () => {
      const rawToken = await service.register(ownerUserId, 'ua-sliding');
      const tokenHash = tokenService.hashToken(rawToken);

      // expiresAt을 단축해 sliding이 갱신을 트리거하도록 (10일만 남음)
      const shortenedExpiresAt = new Date(Date.now() + 10 * DAY);
      await db.db
        .update(trustedDevices)
        .set({ expiresAt: shortenedExpiresAt })
        .where(eq(trustedDevices.tokenHash, tokenHash));

      const verifiedAt = Date.now();
      const ok = await service.verify(rawToken, ownerUserId);
      expect(ok).toBe(true);

      const [row] = await db.db
        .select({ expiresAt: trustedDevices.expiresAt })
        .from(trustedDevices)
        .where(eq(trustedDevices.tokenHash, tokenHash));

      // sliding으로 단축됐던 expiresAt이 now + 30일 부근까지 갱신됨
      expect(row!.expiresAt.getTime()).toBeGreaterThan(shortenedExpiresAt.getTime());
      expect(row!.expiresAt.getTime()).toBeGreaterThan(verifiedAt + 29 * DAY);
      expect(row!.expiresAt.getTime()).toBeLessThanOrEqual(verifiedAt + 30 * DAY + 1000);
    });
  });

  describe('hard cap (TRUST_ABSOLUTE_MAX_MS = 90일)', () => {
    it('now + 30일이 createdAt + 90일을 넘기면 cap 값으로 제한된다', async () => {
      const rawToken = await service.register(ownerUserId, 'ua-cap');
      const tokenHash = tokenService.hashToken(rawToken);

      // createdAt을 75일 전으로 위조 → sliding(now + 30일)이 cap(createdAt + 90일 = now + 15일)을 초과하는 상태
      const fakeCreatedAt = new Date(Date.now() - 75 * DAY);
      const beforeCapExpiresAt = new Date(Date.now() + 5 * DAY);
      await db.db
        .update(trustedDevices)
        .set({ createdAt: fakeCreatedAt, expiresAt: beforeCapExpiresAt })
        .where(eq(trustedDevices.tokenHash, tokenHash));

      const ok = await service.verify(rawToken, ownerUserId);
      expect(ok).toBe(true);

      const [row] = await db.db
        .select({ expiresAt: trustedDevices.expiresAt })
        .from(trustedDevices)
        .where(eq(trustedDevices.tokenHash, tokenHash));

      const expectedCap = fakeCreatedAt.getTime() + 90 * DAY;
      // cap 값이 정확히 일치하지 않을 수 있으나 (clock drift) ±1초 허용
      expect(Math.abs(row!.expiresAt.getTime() - expectedCap)).toBeLessThan(1000);
    });

    it('이미 cap에 도달한 trust는 verify 시 expiresAt이 갱신되지 않는다', async () => {
      const rawToken = await service.register(ownerUserId, 'ua-at-cap');
      const tokenHash = tokenService.hashToken(rawToken);

      // createdAt이 80일 전, expiresAt이 cap(createdAt + 90일 = 10일 후)에 도달
      const fakeCreatedAt = new Date(Date.now() - 80 * DAY);
      const capAt = new Date(fakeCreatedAt.getTime() + 90 * DAY);
      await db.db
        .update(trustedDevices)
        .set({ createdAt: fakeCreatedAt, expiresAt: capAt })
        .where(eq(trustedDevices.tokenHash, tokenHash));

      await service.verify(rawToken, ownerUserId);

      const [row] = await db.db
        .select({ expiresAt: trustedDevices.expiresAt })
        .from(trustedDevices)
        .where(eq(trustedDevices.tokenHash, tokenHash));

      // cap 값에 머물러 있어야 한다 (newExpiresAt <= 현재 expiresAt → refreshExpiresAt 호출 안 됨)
      expect(row!.expiresAt.getTime()).toBe(capAt.getTime());
    });
  });
});

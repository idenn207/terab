import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, drives, mountCredentials, users } from '@terab/db';
import { TokenService } from '@terab/security';
import { eq } from 'drizzle-orm';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const SHOULD_RUN =
  process.env.STORAGE_AGENT_E2E === '1' && (process.platform === 'linux' || process.platform === 'darwin');

const WORKTREE_ROOT = path.resolve(__dirname, '..', '..', '..');
const AGENT_BIN_CANDIDATES = ['agent-linux-amd64', 'agent-linux-arm64', 'agent'];
const FAKEDSM_BIN_CANDIDATES = ['fakedsm-linux-amd64', 'fakedsm-linux-arm64', 'fakedsm'];

const PORTAL_HOST = '127.0.0.1';
const PORTAL_PORT = '3260';
const DRIVE_ROOT = '/volume1/drives';

function locateBinary(candidates: string[]): string | null {
  const binDir = path.join(WORKTREE_ROOT, 'services', 'storage-agent', 'bin');
  for (const name of candidates) {
    const candidate = path.join(binDir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function waitForSocket(socketPath: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const s = statSync(socketPath);
      if (s.isSocket()) return;
    } catch {
      /* not yet — keep polling */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`agent socket did not appear at ${socketPath} within ${timeoutMs}ms`);
}

(SHOULD_RUN ? describe : describe.skip)('MountCredential (e2e via fakedsm)', () => {
  let agentProcess: ChildProcess | null = null;
  let tmpDir = '';
  let socketPath = '';
  let secretDir = '';
  let stateFile = '';
  let app: INestApplication<App> | null = null;
  let db: DatabaseService;
  let ownerUserId: string;
  let accessToken: string;

  beforeAll(async () => {
    const agentBin = locateBinary(AGENT_BIN_CANDIDATES);
    const fakedsmBin = locateBinary(FAKEDSM_BIN_CANDIDATES);
    if (!agentBin || !fakedsmBin) {
      throw new Error(
        'agent/fakedsm binary not found. Run `make build && make fakedsm` inside services/storage-agent first.',
      );
    }

    tmpDir = mkdtempSync(path.join(tmpdir(), 'mount-credential-e2e-'));
    socketPath = path.join(tmpDir, 'agent.sock');
    secretDir = path.join(tmpDir, 'secrets');
    stateFile = path.join(tmpDir, 'fakedsm-state.json');

    agentProcess = spawn(
      agentBin,
      ['-socket', socketPath, '-dsm-binary', fakedsmBin, '-dev', '-log-level', 'debug'],
      {
        env: { ...process.env, FAKEDSM_STATE_FILE: stateFile },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    agentProcess.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[agent] ${chunk.toString()}`);
    });

    await waitForSocket(socketPath, 5_000);

    // ConfigService 가 AppModule 부팅 시 읽으므로 createTestingModule 전에 셋업
    process.env.STORAGE_AGENT_SOCKET_PATH = socketPath;
    process.env.STORAGE_SECRET_DIR = secretDir;
    process.env.STORAGE_AGENT_PORTAL_HOST = PORTAL_HOST;
    process.env.STORAGE_AGENT_PORTAL_PORT = PORTAL_PORT;
    process.env.STORAGE_DRIVE_ROOT = DRIVE_ROOT;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DatabaseService);

    const [ownerRow] = await db.db.select({ id: users.id }).from(users).where(eq(users.username, 'owner'));
    if (!ownerRow) {
      throw new Error(
        'owner 계정이 없습니다. OWNER_PASSWORD 환경변수가 설정된 상태에서 AppModule 이 부팅돼 owner 계정이 생성돼야 합니다.',
      );
    }
    ownerUserId = ownerRow.id;

    const tokenService = app.get(TokenService);
    accessToken = tokenService.generateAccessToken(ownerUserId, 'owner', []);

    await cleanupOwnerData();
  }, 30_000);

  afterAll(async () => {
    if (db) await cleanupOwnerData();
    if (app) await app.close();
    if (agentProcess && !agentProcess.killed) {
      agentProcess.kill('SIGTERM');
      await new Promise<void>((r) => {
        const t = setTimeout(() => r(), 3_000);
        agentProcess!.on('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  async function cleanupOwnerData(): Promise<void> {
    // 외래키 cascade 로 drives 삭제 시 mount_credentials 도 삭제되지만 명시적으로
    await db.db.delete(mountCredentials).where(eq(mountCredentials.userId, ownerUserId));
    await db.db.delete(drives).where(eq(drives.ownerId, ownerUserId));
  }

  function bearer() {
    return `Bearer ${accessToken}`;
  }

  it('round-trip: issue → list → revoke', async () => {
    // 1. POST /api/mount-credentials — personal drive lazy 생성 + 1회용 password/script 응답
    const issueRes = await request(app!.getHttpServer())
      .post('/mount-credentials')
      .set('Authorization', bearer())
      .send({});

    expect(issueRes.status).toBe(201);
    expect(issueRes.body).toMatchObject({
      protocol: 'iscsi',
      portalHost: PORTAL_HOST,
      portalPort: Number(PORTAL_PORT),
    });
    expect(typeof issueRes.body.id).toBe('string');
    expect(typeof issueRes.body.driveId).toBe('string');
    expect(typeof issueRes.body.iqn).toBe('string');
    expect(issueRes.body.iqn).toMatch(/^iqn\.2026-05\.com\.terab:/);
    expect(typeof issueRes.body.password).toBe('string');
    expect(issueRes.body.password.length).toBeGreaterThanOrEqual(16);
    expect(typeof issueRes.body.script).toBe('string');
    expect(issueRes.body.script).toContain('New-IscsiTargetPortal');
    expect(issueRes.body.script).toContain(issueRes.body.iqn);

    const credentialId = issueRes.body.id as string;

    // 2. GET /api/mount-credentials — 1건, password/script 미포함
    const listRes = await request(app!.getHttpServer())
      .get('/mount-credentials')
      .set('Authorization', bearer());

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toMatchObject({ id: credentialId, protocol: 'iscsi' });
    expect(listRes.body[0].password).toBeUndefined();
    expect(listRes.body[0].script).toBeUndefined();

    // 3. DELETE /api/mount-credentials/:id — 204
    const revokeRes = await request(app!.getHttpServer())
      .delete(`/mount-credentials/${credentialId}`)
      .set('Authorization', bearer());

    expect(revokeRes.status).toBe(204);

    // 4. 회수 후 GET → 0건
    const afterListRes = await request(app!.getHttpServer())
      .get('/mount-credentials')
      .set('Authorization', bearer());

    expect(afterListRes.status).toBe(200);
    expect(afterListRes.body).toHaveLength(0);
  });

  it('active 자격증명 존재 상태에서 재발급 시 MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL', async () => {
    // 첫 발급
    const first = await request(app!.getHttpServer())
      .post('/mount-credentials')
      .set('Authorization', bearer())
      .send({});
    expect(first.status).toBe(201);

    // 회수 없이 두번째 발급 시도 → 409
    const second = await request(app!.getHttpServer())
      .post('/mount-credentials')
      .set('Authorization', bearer())
      .send({});

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('MOUNT_CREDENTIAL_DUPLICATE_PROTOCOL');

    // cleanup
    await request(app!.getHttpServer())
      .delete(`/mount-credentials/${first.body.id}`)
      .set('Authorization', bearer())
      .expect(204);
  });

  it('Bearer 토큰 없이 호출 시 401', async () => {
    const res = await request(app!.getHttpServer()).get('/mount-credentials');
    expect(res.status).toBe(401);
  });

  it('존재하지 않는 credentialId 회수 시 MOUNT_CREDENTIAL_NOT_FOUND', async () => {
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const res = await request(app!.getHttpServer())
      .delete(`/mount-credentials/${fakeId}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MOUNT_CREDENTIAL_NOT_FOUND');
  });
});

if (!SHOULD_RUN) {
  describe('MountCredential (e2e)', () => {
    it.skip('skipped — set STORAGE_AGENT_E2E=1 and run on linux/darwin', () => {
      /* placeholder so jest reports the skipped suite */
    });
  });
}

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LoggerModule } from 'nestjs-pino';
import { StorageAgentClient } from '../src/storage-agent/storage-agent.client';
import { StorageAgentModule } from '../src/storage-agent/storage-agent.module';

const SHOULD_RUN =
  process.env.STORAGE_AGENT_E2E === '1' && (process.platform === 'linux' || process.platform === 'darwin');

const TEST_IQN = 'iqn.2026-05.com.terab:e2e-drive';

const WORKTREE_ROOT = path.resolve(__dirname, '..', '..', '..');
const AGENT_BIN_CANDIDATES = ['agent-linux-amd64', 'agent-linux-arm64', 'agent'];
const FAKEDSM_BIN_CANDIDATES = ['fakedsm-linux-amd64', 'fakedsm-linux-arm64', 'fakedsm'];

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

(SHOULD_RUN ? describe : describe.skip)('StorageAgent (e2e via fakedsm)', () => {
  let agentProcess: ChildProcess | null = null;
  let tmpDir = '';
  let socketPath = '';
  let stateFile = '';
  let moduleRef: TestingModule | null = null;
  let client: StorageAgentClient;

  beforeAll(async () => {
    const agentBin = locateBinary(AGENT_BIN_CANDIDATES);
    const fakedsmBin = locateBinary(FAKEDSM_BIN_CANDIDATES);
    if (!agentBin || !fakedsmBin) {
      throw new Error(
        'agent/fakedsm binary not found. Run `make build && make fakedsm` inside services/storage-agent first.',
      );
    }

    tmpDir = mkdtempSync(path.join(tmpdir(), 'storage-agent-e2e-'));
    socketPath = path.join(tmpDir, 'agent.sock');
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

    process.env.STORAGE_AGENT_SOCKET_PATH = socketPath;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        LoggerModule.forRoot({ pinoHttp: { enabled: false } }),
        StorageAgentModule,
      ],
    }).compile();
    client = moduleRef.get(StorageAgentClient);
  }, 30_000);

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
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

  it('round-trip: createTarget → getTargetStatus → deleteTarget → not_found', async () => {
    const created = await client.createTarget({
      iqn: TEST_IQN,
      name: 'e2e-drive',
      osUsername: 'u',
      osPassword: 'p',
    });
    expect(created.iqn).toBe(TEST_IQN);
    expect(created.id).toBeGreaterThan(0);

    const status = await client.getTargetStatus(TEST_IQN);
    expect(status.iqn).toBe(TEST_IQN);
    expect(status.name).toBe('e2e-drive');

    await client.deleteTarget(TEST_IQN);

    await expect(client.getTargetStatus(TEST_IQN)).rejects.toMatchObject({
      code: 'STORAGE_AGENT_TARGET_NOT_FOUND',
    });
  });

  it('createTarget on duplicate IQN throws STORAGE_AGENT_TARGET_CONFLICT', async () => {
    await client.createTarget({
      iqn: TEST_IQN,
      name: 'first',
      osUsername: 'u',
      osPassword: 'p',
    });

    await expect(
      client.createTarget({
        iqn: TEST_IQN,
        name: 'second',
        osUsername: 'u',
        osPassword: 'p',
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_AGENT_TARGET_CONFLICT' });

    await client.deleteTarget(TEST_IQN);
  });
});

if (!SHOULD_RUN) {
  describe('StorageAgent (e2e)', () => {
    it.skip('skipped — set STORAGE_AGENT_E2E=1 and run on linux/darwin', () => {
      /* placeholder so jest reports the skipped suite */
    });
  });
}

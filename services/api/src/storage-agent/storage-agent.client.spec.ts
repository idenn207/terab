import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider } from '@terab/test';
import { StorageAgentClient } from './storage-agent.client';

type RequestArgs = { method: 'GET' | 'POST' | 'DELETE'; url: string; data?: unknown };
type FakeResponse = { status: number; data: unknown };

const TEST_IQN = 'iqn.2026-05.com.terab:drive-1';

describe('StorageAgentClient', () => {
  let client: StorageAgentClient;
  let requestMock: jest.Mock<Promise<FakeResponse>, [RequestArgs]>;

  beforeEach(async () => {
    requestMock = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        StorageAgentClient,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => '/tmp/storage-agent.sock' },
        },
        createPinoLoggerProvider(StorageAgentClient.name),
      ],
    }).compile();
    client = module.get(StorageAgentClient);

    Object.defineProperty(client, 'http', {
      value: { request: requestMock },
      configurable: true,
    });
  });

  afterEach(() => {
    client.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('createTarget', () => {
    it('성공 시 agent 응답 envelope 의 data 를 반환', async () => {
      requestMock.mockResolvedValue({ status: 201, data: { data: { id: 7, iqn: TEST_IQN } } });
      const result = await client.createTarget({
        iqn: TEST_IQN,
        name: 'drive-1',
        osUsername: 'u',
        osPassword: 'p',
      });
      expect(result).toEqual({ id: 7, iqn: TEST_IQN });
      expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', url: '/v1/targets' }));
    });

    it('409 응답이면 STORAGE_AGENT_TARGET_CONFLICT 던짐', async () => {
      requestMock.mockResolvedValue({
        status: 409,
        data: { error: { code: 'TARGET_CONFLICT', message: 'exists' } },
      });
      await expect(
        client.createTarget({ iqn: TEST_IQN, name: 'x', osUsername: 'u', osPassword: 'p' }),
      ).rejects.toMatchObject({ code: 'STORAGE_AGENT_TARGET_CONFLICT' });
    });

    it('5xx 응답이면 STORAGE_AGENT_INTERNAL 던짐', async () => {
      requestMock.mockResolvedValue({
        status: 500,
        data: { error: { code: 'INTERNAL', message: 'oops' } },
      });
      await expect(
        client.createTarget({ iqn: TEST_IQN, name: 'x', osUsername: 'u', osPassword: 'p' }),
      ).rejects.toMatchObject({ code: 'STORAGE_AGENT_INTERNAL' });
    });

    it('네트워크 오류면 STORAGE_AGENT_UNAVAILABLE 던짐', async () => {
      const netErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
      requestMock.mockRejectedValue(netErr);
      await expect(
        client.createTarget({ iqn: TEST_IQN, name: 'x', osUsername: 'u', osPassword: 'p' }),
      ).rejects.toMatchObject({ code: 'STORAGE_AGENT_UNAVAILABLE' });
    });
  });

  describe('getTargetStatus', () => {
    it('200 응답이면 Target 을 반환', async () => {
      const target = { iqn: TEST_IQN, name: 'd1', status: 'available', connected: false };
      requestMock.mockResolvedValue({ status: 200, data: { data: target } });
      await expect(client.getTargetStatus(TEST_IQN)).resolves.toEqual(target);
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', url: `/v1/targets/${encodeURIComponent(TEST_IQN)}` }),
      );
    });

    it('404 응답이면 STORAGE_AGENT_TARGET_NOT_FOUND 던짐', async () => {
      requestMock.mockResolvedValue({
        status: 404,
        data: { error: { code: 'TARGET_NOT_FOUND', message: 'no' } },
      });
      await expect(client.getTargetStatus(TEST_IQN)).rejects.toMatchObject({
        code: 'STORAGE_AGENT_TARGET_NOT_FOUND',
      });
    });
  });

  describe('deleteTarget', () => {
    it('204 응답이면 void 반환', async () => {
      requestMock.mockResolvedValue({ status: 204, data: '' });
      await expect(client.deleteTarget(TEST_IQN)).resolves.toBeUndefined();
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', url: `/v1/targets/${encodeURIComponent(TEST_IQN)}` }),
      );
    });

    it('404 응답이면 STORAGE_AGENT_TARGET_NOT_FOUND 던짐', async () => {
      requestMock.mockResolvedValue({
        status: 404,
        data: { error: { code: 'TARGET_NOT_FOUND', message: 'no' } },
      });
      await expect(client.deleteTarget(TEST_IQN)).rejects.toMatchObject({
        code: 'STORAGE_AGENT_TARGET_NOT_FOUND',
      });
    });
  });
});

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import http from 'node:http';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  AGENT_ERROR_CODES,
  AgentErrorBody,
  CreateTargetRequest,
  CreateTargetResult,
  Target,
} from './storage-agent.types';

const SOCKET_PATH_ENV = 'STORAGE_AGENT_SOCKET_PATH';
const REQUEST_TIMEOUT_MS = 10_000;
const BASE_URL = 'http://localhost';

@Injectable()
export class StorageAgentClient implements OnModuleDestroy {
  private readonly http: AxiosInstance;
  private readonly httpAgent: http.Agent;

  constructor(
    config: ConfigService,
    @InjectPinoLogger(StorageAgentClient.name) private readonly logger: PinoLogger,
  ) {
    const socketPath = config.getOrThrow<string>(SOCKET_PATH_ENV);
    // Node 의 http.Agent 는 socketPath 를 런타임 지원하지만 d.ts 에는 없음 — agent 옵션 cast.
    this.httpAgent = new http.Agent({ keepAlive: true, socketPath } as http.AgentOptions & { socketPath: string });
    this.http = axios.create({
      baseURL: BASE_URL,
      httpAgent: this.httpAgent,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  }

  onModuleDestroy(): void {
    this.httpAgent.destroy();
  }

  async createTarget(req: CreateTargetRequest): Promise<CreateTargetResult> {
    const res = await this.send('POST', '/v1/targets', req);
    return this.expectData<CreateTargetResult>(res, 201, 'createTarget', req.iqn);
  }

  async getTargetStatus(iqn: string): Promise<Target> {
    const res = await this.send('GET', `/v1/targets/${encodeURIComponent(iqn)}`);
    return this.expectData<Target>(res, 200, 'getTargetStatus', iqn);
  }

  async deleteTarget(iqn: string): Promise<void> {
    const res = await this.send('DELETE', `/v1/targets/${encodeURIComponent(iqn)}`);
    if (res.status === 204) return;
    this.throwForResponse(res, 'deleteTarget', iqn);
  }

  private async send(method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown) {
    try {
      return await this.http.request({ method, url, data: body });
    } catch (err) {
      const axiosErr = err as AxiosError;
      // 원본 AxiosError 를 로깅하지 않는다 — config.data 가 createTarget 요청 본문(osPassword 포함) 문자열을
      // 품고 있어 log transport 로 평문 secret 이 새어나간다. 필요한 필드만 whitelist 한다.
      this.logger.error({ method, url, code: axiosErr.code }, 'storage-agent network failure');
      throw new ApiException('STORAGE_AGENT_UNAVAILABLE');
    }
  }

  private expectData<T>(res: { status: number; data: unknown }, expected: number, op: string, iqn: string): T {
    if (res.status === expected) {
      const payload = res.data as { data?: T } | T;
      return ((payload as { data?: T }).data ?? payload) as T;
    }
    this.throwForResponse(res, op, iqn);
  }

  private throwForResponse(res: { status: number; data: unknown }, op: string, iqn: string): never {
    const body = res.data as Partial<AgentErrorBody> | null | undefined;
    const code = body?.error?.code;
    this.logger.warn({ status: res.status, agentCode: code, op, iqn }, 'storage-agent non-success response');
    if (res.status === 404 || code === AGENT_ERROR_CODES.TARGET_NOT_FOUND) {
      throw new ApiException('STORAGE_AGENT_TARGET_NOT_FOUND');
    }
    if (res.status === 409 || code === AGENT_ERROR_CODES.TARGET_CONFLICT) {
      throw new ApiException('STORAGE_AGENT_TARGET_CONFLICT');
    }
    throw new ApiException('STORAGE_AGENT_INTERNAL');
  }
}

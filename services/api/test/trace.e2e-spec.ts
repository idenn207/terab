import { Controller, Get, HttpStatus, INestApplication, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApiException, ApiExceptionFilter, ErrorCode, ErrorCodeKey } from '@terab/common';
import { AutoTrace, LogReplay, PiiMasker, ServiceMethodWrapper, TraceFlusher, TraceInterceptor } from '@terab/logger';
import { createPinoLoggerProvider, mockPinoLogger } from '@terab/test';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import request from 'supertest';

const codeRecord = ErrorCode as unknown as Record<string, { message: string; status: HttpStatus }>;
const errorCode4xx = (Object.entries(codeRecord).find(([, d]) => +d.status < 500)?.[0] ?? 'UNKNOWN') as ErrorCodeKey;
const errorCode5xx = Object.entries(codeRecord).find(([, d]) => +d.status >= 500)?.[0] as ErrorCodeKey;

@Injectable()
@AutoTrace()
class DummyService {
  async ok(): Promise<string> {
    return 'hello';
  }

  @LogReplay()
  async failWith4xx(_input: string): Promise<void> {
    throw new ApiException(errorCode4xx);
  }

  @LogReplay()
  async failWith5xx(_input: string): Promise<void> {
    if (!errorCode5xx) throw new Error('no 5xx code in ErrorCode');
    throw new ApiException(errorCode5xx);
  }

  async failWithUnhandled(): Promise<void> {
    throw new Error('boom');
  }
}

@Controller('trace-test')
class DummyController {
  constructor(private readonly svc: DummyService) {}

  @Get('ok')
  async ok() {
    return this.svc.ok();
  }

  @Get('fail4')
  async fail4() {
    return this.svc.failWith4xx('topsecret');
  }

  @Get('fail5')
  async fail5() {
    return this.svc.failWith5xx('topsecret');
  }

  @Get('boom')
  async boom() {
    return this.svc.failWithUnhandled();
  }
}

@Module({
  imports: [DiscoveryModule, PinoLoggerModule.forRoot({ pinoHttp: { enabled: false } })],
  controllers: [DummyController],
  providers: [
    PiiMasker,
    ServiceMethodWrapper,
    TraceFlusher,
    TraceInterceptor,
    DummyService,
    createPinoLoggerProvider(TraceFlusher.name),
    createPinoLoggerProvider(ApiExceptionFilter.name),
    { provide: APP_INTERCEPTOR, useExisting: TraceInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
class TestModule {}

describe('Service Trace Logging (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('정상 요청은 trace.meta(info)만 한 줄 남긴다', async () => {
    await request(app.getHttpServer()).get('/trace-test/ok').expect(200);
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).not.toHaveBeenCalled();
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      event: 'trace.meta',
      outcome: 'ok',
      hasDetail: false,
    });
  });

  it('4xx ApiException은 meta(info) + detail(debug)을 남긴다 — debug는 prod에서 level 필터링됨', async () => {
    await request(app.getHttpServer()).get('/trace-test/fail4');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).not.toHaveBeenCalled();
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      event: 'trace.meta',
      outcome: 'api_exception',
      hasDetail: false,
    });
    expect(mockPinoLogger.debug.mock.calls[0][0]).toMatchObject({
      event: 'trace.detail',
    });
  });

  it('5xx ApiException은 trace.meta + trace.detail 둘 다 남긴다', async () => {
    if (!errorCode5xx) return;
    await request(app.getHttpServer()).get('/trace-test/fail5');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error.mock.calls[0][0]).toMatchObject({ event: 'trace.detail' });
  });

  it('catch되지 않은 일반 예외는 outcome=unhandled로 meta+detail 남긴다', async () => {
    await request(app.getHttpServer()).get('/trace-test/boom');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      outcome: 'unhandled',
      hasDetail: true,
    });
  });
});

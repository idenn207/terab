import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider, mockPinoLogger } from '@terab/test';
import { UploadSessionCleanupWorker } from './upload-session.cleanup.worker';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionService = {
  cleanupExpired: jest.fn(),
};

const mockQueue = {
  removeJobScheduler: jest.fn(),
  add: jest.fn(),
};

const mockBullmqWorker = { on: jest.fn() };

describe('UploadSessionCleanupWorker', () => {
  let worker: UploadSessionCleanupWorker;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadSessionCleanupWorker,
        { provide: UploadSessionService, useValue: mockUploadSessionService },
        { provide: getQueueToken('upload-session-cleanup'), useValue: mockQueue },
        createPinoLoggerProvider(UploadSessionCleanupWorker.name),
      ],
    }).compile();
    worker = module.get(UploadSessionCleanupWorker);
    Object.defineProperty(worker, 'worker', { value: mockBullmqWorker, configurable: true });
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('process는 cleanupExpired(500)을 호출하고 tick 완료 info 로그를 남긴다', async () => {
      mockUploadSessionService.cleanupExpired.mockResolvedValue({ scannedCount: 0, abortedCount: 0, removedCount: 0 });
      await worker.process({ data: {} } as any);
      expect(mockUploadSessionService.cleanupExpired).toHaveBeenCalledWith(500);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ scannedCount: 0, abortedCount: 0, removedCount: 0, batchSize: 500 }),
        '업로드 세션 정리 tick 완료',
      );
    });
  });

  describe('onApplicationBootstrap', () => {
    it('이전 repeatable 제거 후 새로 등록하고 스케줄러 등록 info 로그를 남긴다', async () => {
      mockQueue.removeJobScheduler.mockResolvedValue(undefined);

      await worker.onApplicationBootstrap();

      expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith('upload-session-cleanup-tick');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'upload-session-cleanup-tick',
        {},
        expect.objectContaining({
          jobId: 'upload-session-cleanup-tick',
          repeat: { every: 15 * 60 * 1000 },
        }),
      );
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ intervalMs: 15 * 60 * 1000, batchSize: 500 }),
        'upload-session-cleanup 스케줄러 등록 완료',
      );
    });
  });

  describe('worker.on(failed)', () => {
    async function registerHandlersAndReturnFailedHandler() {
      mockQueue.removeJobScheduler.mockResolvedValue(undefined);
      await worker.onApplicationBootstrap();
      return mockBullmqWorker.on.mock.calls.find(([event]: [string]) => event === 'failed')[1] as (
        job: unknown,
        err: Error,
      ) => void;
    }

    it('job이 null이면 error 로깅을 호출하지 않는다', async () => {
      const handler = await registerHandlersAndReturnFailedHandler();
      handler(null, new Error('no job'));
      expect(mockPinoLogger.error).not.toHaveBeenCalled();
    });

    it('attemptsMade < maxAttempts면 error 로깅을 호출하지 않는다', async () => {
      const handler = await registerHandlersAndReturnFailedHandler();
      const job = { id: 'j1', attemptsMade: 1, opts: { attempts: 3 } };

      handler(job, new Error('partial fail'));

      expect(mockPinoLogger.error).not.toHaveBeenCalled();
    });

    it('attemptsMade >= maxAttempts면 error 로깅을 호출한다', async () => {
      const handler = await registerHandlersAndReturnFailedHandler();
      const job = { id: 'j1', attemptsMade: 3, opts: { attempts: 3 } };

      handler(job, new Error('final fail'));

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'j1', attemptsMade: 3 }),
        expect.stringContaining('최종 실패'),
      );
    });
  });

  describe('worker.on(error)', () => {
    it('worker 내부 오류 발생 시 error 로깅을 호출한다', async () => {
      mockQueue.removeJobScheduler.mockResolvedValue(undefined);
      await worker.onApplicationBootstrap();

      const handler = mockBullmqWorker.on.mock.calls.find(([event]: [string]) => event === 'error')[1] as (
        err: Error,
      ) => void;
      const err = new Error('worker error');
      handler(err);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err }),
        'upload-session-cleanup worker 내부 오류',
      );
    });
  });
});

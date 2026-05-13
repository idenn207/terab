import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider } from '@terab/test';
import { UploadSessionCleanupWorker } from './upload-session.cleanup.worker';
import { UploadSessionService } from './upload-session.service';

const mockUploadSessionService = {
  cleanupExpired: jest.fn(),
};

const mockQueue = {
  removeJobScheduler: jest.fn(),
  add: jest.fn(),
};

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
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('process는 cleanupExpired(500)을 호출한다', async () => {
      mockUploadSessionService.cleanupExpired.mockResolvedValue({ scanned: 0, deleted: 0, errors: 0 });
      await worker.process({ data: {} } as any);
      expect(mockUploadSessionService.cleanupExpired).toHaveBeenCalledWith(500);
    });
  });

  describe('onApplicationBootstrap', () => {
    it('이전 repeatable 제거 후 새로 등록한다', async () => {
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
    });
  });
});

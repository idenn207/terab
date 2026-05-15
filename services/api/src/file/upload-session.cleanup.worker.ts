import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UploadSessionService } from './upload-session.service';

@Processor('upload-session-cleanup')
export class UploadSessionCleanupWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly TICK_JOB_ID = 'upload-session-cleanup-tick';
  private readonly TICK_INTERVAL_MS = 15 * 60 * 1000;
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectQueue('upload-session-cleanup') private readonly queue: Queue,
    private readonly uploadSessionService: UploadSessionService,
    @InjectPinoLogger(UploadSessionCleanupWorker.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 이전 등록을 정리 후 새로 등록 — 옵션 변경 시 누적 방지
    await this.queue.removeJobScheduler(this.TICK_JOB_ID).catch(() => undefined);
    await this.queue.add(
      this.TICK_JOB_ID,
      {},
      {
        jobId: this.TICK_JOB_ID,
        repeat: { every: this.TICK_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      const max = job.opts.attempts ?? 1;
      if (job.attemptsMade >= max) {
        this.logger.error(
          { err, jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts: max },
          'upload-session-cleanup 최종 실패 — 재시도 소진',
        );
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, 'upload-session-cleanup worker 내부 오류');
    });

    this.logger.info(
      { intervalMs: this.TICK_INTERVAL_MS, batchSize: this.BATCH_SIZE },
      'upload-session-cleanup 스케줄러 등록 완료',
    );
  }

  async process(_job: Job): Promise<void> {
    const start = Date.now();
    const stats = await this.uploadSessionService.cleanupExpired(this.BATCH_SIZE);
    this.logger.info(
      { ...stats, durationMs: Date.now() - start, batchSize: this.BATCH_SIZE },
      '업로드 세션 정리 tick 완료',
    );
  }
}

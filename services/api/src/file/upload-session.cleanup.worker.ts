import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { AutoTrace } from '@terab/logger';
import { Job, Queue } from 'bullmq';
import { UploadSessionService } from './upload-session.service';

@AutoTrace()
@Processor('upload-session-cleanup')
export class UploadSessionCleanupWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly TICK_JOB_ID = 'upload-session-cleanup-tick';
  private readonly TICK_INTERVAL_MS = 15 * 60 * 1000;
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectQueue('upload-session-cleanup') private readonly queue: Queue,
    private readonly uploadSessionService: UploadSessionService,
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
  }

  async process(_job: Job): Promise<void> {
    await this.uploadSessionService.cleanupExpired(this.BATCH_SIZE);
  }
}

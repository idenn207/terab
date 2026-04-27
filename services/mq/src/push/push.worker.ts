import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FcmService } from './fcm/fcm.service';
import { PushChallengeJob } from './types/push-challenge-job.interface';

@Processor('push-challenge')
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  constructor(private readonly fcmService: FcmService) {
    super();
  }

  async process(job: Job<PushChallengeJob>): Promise<void> {
    await this.fcmService.send(job.data);
  }
}

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
    const { pushToken, challengeId } = job.data;

    if (!pushToken) {
      // 로그아웃 / 비활성화된 device 가 publisher 단을 통과해 큐잉된 경우 — FCM 호출 전 차단
      this.logger.warn({ challengeId }, 'push skipped: empty token');
      return;
    }

    await this.fcmService.send(job.data);
  }
}

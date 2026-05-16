import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { AutoTrace, LogReplay } from '@terab/logger';
import type { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { PushChallengeJob } from './types/push-challenge-job.interface';

export const PUSH_CHALLENGE_QUEUE = 'push-challenge';

@Injectable()
@AutoTrace()
export class PushChallengePublisher {
  constructor(
    @InjectQueue(PUSH_CHALLENGE_QUEUE) private readonly queue: Queue<PushChallengeJob>,
    @InjectPinoLogger(PushChallengePublisher.name) private readonly logger: PinoLogger,
  ) {}

  @LogReplay()
  async publish(job: PushChallengeJob): Promise<void> {
    try {
      const added = await this.queue.add('send', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info({ jobId: added.id, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 완료');
    } catch (err) {
      this.logger.error({ err, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 실패');
      throw err;
    }
  }
}

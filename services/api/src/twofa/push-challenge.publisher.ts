import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { PushChallengeJob } from './types/push-challenge-job.interface';

export const PUSH_CHALLENGE_QUEUE = 'push-challenge';

@Injectable()
export class PushChallengePublisher {
  constructor(@InjectQueue(PUSH_CHALLENGE_QUEUE) private readonly queue: Queue<PushChallengeJob>) {}

  async publish(job: PushChallengeJob): Promise<void> {
    await this.queue.add('send', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

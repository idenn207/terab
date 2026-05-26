import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { createPinoLoggerProvider } from '@terab/test';
import { PushChallengePublisher, PUSH_CHALLENGE_QUEUE } from './push-challenge.publisher';

describe('PushChallengePublisher', () => {
  let publisher: PushChallengePublisher;
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushChallengePublisher,
        { provide: getQueueToken(PUSH_CHALLENGE_QUEUE), useValue: mockQueue },
        createPinoLoggerProvider(PushChallengePublisher.name),
      ],
    }).compile();

    publisher = module.get(PushChallengePublisher);
    jest.clearAllMocks();
  });

  describe('publish', () => {
    const job = { userId: 'u1', pushToken: 't1', challengeId: 'c1', options: 'a,b', expiresAt: 'iso' };

    it('queue.add가 실패하면 예외를 전파한다', async () => {
      const err = new Error('enqueue failed');
      mockQueue.add.mockRejectedValue(err);

      await expect(publisher.publish(job)).rejects.toThrow('enqueue failed');
    });

    it('정상 enqueue 시 throw하지 않는다', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await expect(publisher.publish(job)).resolves.toBeUndefined();
      expect(mockQueue.add).toHaveBeenCalledWith('send', job, expect.objectContaining({ attempts: 3 }));
    });
  });
});

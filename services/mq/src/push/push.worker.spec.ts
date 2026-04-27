import { Test } from '@nestjs/testing';
import { FcmService } from './fcm/fcm.service';
import { PushWorker } from './push.worker';

const mockFcmService = {
  send: jest.fn(),
};

describe('PushWorker', () => {
  let worker: PushWorker;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PushWorker, { provide: FcmService, useValue: mockFcmService }],
    }).compile();
    worker = module.get(PushWorker);
    jest.clearAllMocks();
  });

  it('job.data를 FcmService.send에 전달한다', async () => {
    const jobData = {
      userId: 'user-id',
      pushToken: 'token',
      challengeId: 'challenge-id',
      options: '47,82,13',
      expiresAt: new Date().toISOString(),
    };

    await worker.process({ data: jobData } as any);

    expect(mockFcmService.send).toHaveBeenCalledWith(jobData);
  });

  it('FcmService.send가 실패하면 에러를 전파한다', async () => {
    mockFcmService.send.mockRejectedValue(new Error('FCM 전송 실패'));

    await expect(worker.process({ data: {} } as any)).rejects.toThrow('FCM 전송 실패');
  });
});

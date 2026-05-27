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
    const jobData = {
      userId: 'user-id',
      pushToken: 'token',
      challengeId: 'challenge-id',
      options: '47,82,13',
      expiresAt: new Date().toISOString(),
    };
    mockFcmService.send.mockRejectedValue(new Error('FCM 전송 실패'));

    await expect(worker.process({ data: jobData } as any)).rejects.toThrow('FCM 전송 실패');
  });

  it('pushToken이 빈 문자열이면 FcmService.send를 호출하지 않고 종료된다', async () => {
    const jobData = {
      userId: 'user-id',
      pushToken: '',
      challengeId: 'challenge-empty',
      options: '47,82,13',
      expiresAt: new Date().toISOString(),
    };

    await worker.process({ data: jobData } as any);

    expect(mockFcmService.send).not.toHaveBeenCalled();
  });

  it('pushToken이 null이면 FcmService.send를 호출하지 않고 종료된다', async () => {
    const jobData = {
      userId: 'user-id',
      pushToken: null as unknown as string,
      challengeId: 'challenge-null',
      options: '47,82,13',
      expiresAt: new Date().toISOString(),
    };

    await worker.process({ data: jobData } as any);

    expect(mockFcmService.send).not.toHaveBeenCalled();
  });
});

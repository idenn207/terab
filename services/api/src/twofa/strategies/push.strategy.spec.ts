import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { DatabaseService, TransactionContext } from '@terab/db';
import { mockDatabaseService, mockTransactionContext } from '@terab/test';
import { TwoFaRepository } from '../twofa.repository';
import { PushTwoFaStrategy } from './push.strategy';

const mockTwoFaRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  findUserWithPermissionsById: jest.fn(),
};

describe('PushTwoFaStrategy', () => {
  let strategy: PushTwoFaStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushTwoFaStrategy,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TransactionContext, useValue: mockTransactionContext },
        { provide: TwoFaRepository, useValue: mockTwoFaRepository },
      ],
    }).compile();

    strategy = module.get(PushTwoFaStrategy);
    jest.clearAllMocks();
  });

  it('type은 PUSH다', () => {
    expect(strategy.type).toBe('PUSH');
  });

  describe('startSetup', () => {
    it('TWO_FA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.startSetup('user-1')).rejects.toMatchObject({
        code: 'TWO_FA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('completeSetup', () => {
    it('TWO_FA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.completeSetup('user-1', {})).rejects.toMatchObject({
        code: 'TWO_FA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('createChallenge', () => {
    it('options 3개와 correctNum을 포함한 챌린지를 생성한다', async () => {
      mockTwoFaRepository.insert.mockImplementation(async (data) => ({ ...data, id: 'c1' }));

      const challenge = await strategy.createChallenge('user-1');

      const parts = (challenge.options as string).split(',');
      expect(parts).toHaveLength(3);
      expect(parts).toContain(challenge.correctNum);
    });
  });

  describe('verifyResponse', () => {
    it('챌린지가 없으면 ApiException(TWO_FA_CHALLENGE_NOT_FOUND)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue(null);

      await expect(strategy.verifyResponse('u', 'c', { selectedNumber: '47' })).rejects.toThrow(ApiException);
    });

    it('소유자 다르면 ApiException(FORBIDDEN)을 던진다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'other',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      await expect(strategy.verifyResponse('u', 'c', { selectedNumber: '47' })).rejects.toThrow(ApiException);
    });

    it('정답이면 true를 반환하고 APPROVED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      const ok = await strategy.verifyResponse('u', 'c', { selectedNumber: '47' });

      expect(ok).toBe(true);
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'APPROVED', expect.any(Date));
    });

    it('오답이면 false를 반환하고 DENIED로 변경한다', async () => {
      mockTwoFaRepository.findById.mockResolvedValue({
        id: 'c',
        userId: 'u',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        correctNum: '47',
      });

      const ok = await strategy.verifyResponse('u', 'c', { selectedNumber: '82' });

      expect(ok).toBe(false);
      expect(mockTwoFaRepository.updateStatus).toHaveBeenCalledWith('c', 'DENIED', expect.any(Date));
    });
  });

  describe('list', () => {
    it('TWO_FA_SETUP_NOT_SUPPORTED를 던진다 (push는 instance 개념 없음)', async () => {
      await expect(strategy.list('user-1')).rejects.toMatchObject({
        code: 'TWO_FA_SETUP_NOT_SUPPORTED',
      });
    });
  });

  describe('revoke', () => {
    it('TWO_FA_SETUP_NOT_SUPPORTED를 던진다', async () => {
      await expect(strategy.revoke('user-1', 'x')).rejects.toMatchObject({
        code: 'TWO_FA_SETUP_NOT_SUPPORTED',
      });
    });
  });
});

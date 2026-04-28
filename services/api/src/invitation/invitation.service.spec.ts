import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { InvitationRepository } from './invitation.repository';
import { InvitationService } from './invitation.service';

const mockInvitationRepository = {
  insert: jest.fn(),
  findByToken: jest.fn(),
  deactivate: jest.fn(),
  markUsed: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('https://drive.skypark207.com'),
};

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: InvitationRepository, useValue: mockInvitationRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('초대 URL을 반환한다', async () => {
      mockInvitationRepository.insert.mockResolvedValue({
        token: 'test-token-uuid',
        expiresAt: new Date('2026-05-05'),
      });

      const result = await service.create('creator-id');

      expect(result.url).toBe('https://drive.skypark207.com/register/test-token-uuid');
      expect(result.token).toBe('test-token-uuid');
    });
  });

  describe('validate', () => {
    it('토큰이 없으면 false를 반환한다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue(null);
      expect(await service.validate('no-token')).toBe(false);
    });

    it('비활성화된 초대는 false를 반환한다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('사용된 초대는 false를 반환한다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('만료된 초대는 false를 반환한다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.validate('token')).toBe(false);
    });

    it('유효한 초대는 true를 반환한다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      expect(await service.validate('token')).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('토큰이 없으면 INVITATION_NOT_FOUND를 던진다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue(null);
      await expect(service.validateOrThrow('no-token')).rejects.toThrow(ApiException);
    });

    it('비활성화된 초대는 INVITATION_NOT_FOUND를 던진다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      await expect(service.validateOrThrow('token')).rejects.toThrow(ApiException);
    });

    it('사용된 초대는 INVITATION_ALREADY_USED를 던진다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      });

      let code: string | undefined;
      try {
        await service.validateOrThrow('token');
      } catch (e) {
        code = (e as ApiException).code;
      }
      expect(code).toBe('INVITATION_ALREADY_USED');
    });

    it('만료된 초대는 INVITATION_EXPIRED를 던진다', async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        deactivatedAt: null,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      let code: string | undefined;
      try {
        await service.validateOrThrow('token');
      } catch (e) {
        code = (e as ApiException).code;
      }
      expect(code).toBe('INVITATION_EXPIRED');
    });
  });
});

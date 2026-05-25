import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthAdmin } from '@terab/test';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

describe('InvitationController', () => {
  let controller: InvitationController;
  let service: jest.Mocked<InvitationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: {
            create: jest.fn(),
            validate: jest.fn(),
            deactivate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(InvitationController);
    service = module.get(InvitationService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('현재 사용자 id와 expiresInDays로 service.create를 호출하고 결과를 반환한다', async () => {
      const expected = { token: 'tok-1', url: 'https://x/register/tok-1', expiresAt: new Date('2030-01-01') };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockAuthAdmin, { expiresInDays: 7 });

      expect(service.create).toHaveBeenCalledWith(mockAuthAdmin.userId, 7);
      expect(result).toEqual(expected);
    });

    it('expiresInDays 미지정 시에도 service.create를 호출한다', async () => {
      const expected = { token: 'tok-2', url: 'https://x/register/tok-2', expiresAt: new Date('2030-01-01') };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockAuthAdmin, {});

      expect(service.create).toHaveBeenCalledWith(mockAuthAdmin.userId, undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('validate', () => {
    it('토큰이 유효하면 { valid: true } 반환', async () => {
      service.validate.mockResolvedValue({ valid: true });

      const result = await controller.validate('valid-token');

      expect(service.validate).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({ valid: true });
    });

    it('토큰이 무효이면 { valid: false } 반환', async () => {
      service.validate.mockResolvedValue({ valid: false });

      const result = await controller.validate('invalid-token');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('deactivate', () => {
    it('토큰으로 service.deactivate를 호출한다', async () => {
      service.deactivate.mockResolvedValue(undefined);

      await controller.deactivate('tok-1');

      expect(service.deactivate).toHaveBeenCalledWith('tok-1');
    });

    it('service.deactivate에서 INVITATION_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.deactivate.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));

      await expect(controller.deactivate('ghost-token')).rejects.toThrow(ApiException);
      await expect(controller.deactivate('ghost-token')).rejects.toMatchObject({
        code: 'INVITATION_NOT_FOUND',
      });
    });
  });
});

import { Test } from '@nestjs/testing';
import { mockAuthAdmin } from '@terab/test';
import { InvitationService } from '../invitation/invitation.service';
import { InvitationAdminController } from './invitation-admin.controller';

describe('InvitationAdminController', () => {
  let controller: InvitationAdminController;
  let service: jest.Mocked<InvitationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvitationAdminController],
      providers: [
        {
          provide: InvitationService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(InvitationAdminController);
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

    it('expiresInDays 미지정 시에도 service.create를 호출한다 — 기본값은 service 책임', async () => {
      const expected = { token: 'tok-2', url: 'https://x/register/tok-2', expiresAt: new Date('2030-01-01') };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockAuthAdmin, {});

      expect(service.create).toHaveBeenCalledWith(mockAuthAdmin.userId, undefined);
      expect(result).toEqual(expected);
    });
  });
});

import { ExecutionContext, HttpStatus, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockAuthAdmin } from '@terab/test';
import { TsRestModule } from '@ts-rest/nest';
import request from 'supertest';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

const mockInvitationService = {
  create: jest.fn(),
  validate: jest.fn(),
  deactivate: jest.fn(),
};

describe('InvitationController', () => {
  let app: INestApplication;
  // let controller: InvitationController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockAuthAdmin;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('POST /invitations ── 초대장을 생성하고 201을 반환한다', async () => {
    const fakeResult = {
      token: 'tok-uuid',
      url: 'https://example.com/invite/tok-uuid',
      expiresAt: new Date('2026-05-10T00:00:00.000Z'),
    };
    mockInvitationService.create.mockResolvedValue(fakeResult);

    const res = await request(app.getHttpServer())
      .post('/invitations')
      .send({ expiresInDays: 7 })
      .expect(HttpStatus.CREATED);

    expect(mockInvitationService.create).toHaveBeenCalledWith('uuid-1', 7);
    expect(res.body.token).toBe('tok-uuid');
  });

  it('GET /invitations/:token — valid: true를 반환한다', async () => {
    mockInvitationService.validate.mockResolvedValue(true);

    const res = await request(app.getHttpServer()).get('/invitations/tok-uuid').expect(HttpStatus.OK);

    expect(mockInvitationService.validate).toHaveBeenCalledWith('tok-uuid');
    expect(res.body).toEqual({ valid: true });
  });

  it('DELETE /invitations/:token — 204를 반환한다', async () => {
    mockInvitationService.deactivate.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/invitations/tok-uuid').expect(204);

    expect(mockInvitationService.deactivate).toHaveBeenCalledWith('tok-uuid');
  });
});

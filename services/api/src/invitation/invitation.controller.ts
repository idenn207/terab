import { Controller, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, RequirePermission } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { InvitationService } from './invitation.service';

@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermission('user:invite')
  @TsRestHandler(contract.invitation.create)
  handleCreate(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invitation.create, async ({ body }) => {
      const result = await this.invitationService.create(user.userId, body.expiresInDays);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @TsRestHandler(contract.invitation.validate)
  handleValidate() {
    return tsRestHandler(contract.invitation.validate, async ({ params }) => {
      const result = await this.invitationService.validate(params.token);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @RequirePermission('user:manage')
  @TsRestHandler(contract.invitation.deactivate)
  handleDeactivate() {
    return tsRestHandler(contract.invitation.deactivate, async ({ params }) => {
      await this.invitationService.deactivate(params.token);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}

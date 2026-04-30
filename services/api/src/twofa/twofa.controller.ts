import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser, Public } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TwoFaService } from './twofa.service';

@Controller()
export class TwoFaController {
  constructor(private readonly twoFaService: TwoFaService) {}

  @Public()
  @TsRestHandler(contract.twofa.getStatus)
  handleGetStatus() {
    return tsRestHandler(contract.twofa.getStatus, async ({ params }) => {
      const result = await this.twoFaService.getStatus(params.id);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.twofa.respond)
  handleRespond(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.twofa.respond, async ({ body, params }) => {
      await this.twoFaService.respond(params.id, user.userId, body.selectedNumber);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @Public()
  @TsRestHandler(contract.twofa.resend)
  handleResend() {
    return tsRestHandler(contract.twofa.resend, async ({ params }) => {
      const result = await this.twoFaService.resend(params.id);
      return { status: HttpStatus.OK, body: { ...result, challengeId: result.id } };
    });
  }
}

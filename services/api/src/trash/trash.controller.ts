import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrashService } from './trash.service';

@Controller()
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @TsRestHandler(contract.trash.list)
  handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.list, async () => {
      const result = await this.trashService.list(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.trash.restore)
  handleRestore(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.restore, async ({ params, body }) => {
      await this.trashService.restore(params.id, body.type, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.trash.permanentDelete)
  handlePermanentDelete(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trash.permanentDelete, async ({ params, body }) => {
      await this.trashService.permanentDelete(params.id, body.type, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}

import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UploadSessionService } from './upload-session.service';

@Controller()
export class FileUploadController {
  constructor(private readonly uploadSessionService: UploadSessionService) {}

  @TsRestHandler(contract.file.uploadInit)
  handleInit(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.uploadInit, async ({ body }) => {
      const result = await this.uploadSessionService.init(user.userId, body);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.file.uploadComplete)
  handleComplete(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.uploadComplete, async ({ params, body }) => {
      const result = await this.uploadSessionService.complete(user.userId, params.sessionId, body.parts);
      return { status: HttpStatus.CREATED, body: result };
    });
  }
}

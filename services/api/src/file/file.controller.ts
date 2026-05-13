import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { FileService } from './file.service';

@Controller()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // @TsRestHandler(contract.file.upload)
  // @UseInterceptors(FileInterceptor('file'))
  // handleUpload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
  //   return tsRestHandler(contract.file.upload, async ({ body }) => {
  //     const result = await this.fileService.upload(user.userId, file, body.folderId);
  //     return { status: HttpStatus.CREATED, body: result };
  //   });
  // }

  @TsRestHandler(contract.file.rename)
  handleRename(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.rename, async ({ params, body }) => {
      const result = await this.fileService.rename(params.id, user.userId, body.name);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.file.move)
  handleMove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.move, async ({ params, body }) => {
      const result = await this.fileService.move(params.id, user.userId, body.folderId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.file.copy)
  handleCopy(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.copy, async ({ params, body }) => {
      const result = await this.fileService.copy(params.id, user.userId, body.folderId);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.file.remove)
  handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.remove, async ({ params }) => {
      await this.fileService.remove(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }

  @TsRestHandler(contract.file.search)
  handleSearch(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.file.search, async ({ query }) => {
      const result = await this.fileService.search(user.userId, query.q, query.scope, query.folderId);
      return { status: HttpStatus.OK, body: result };
    });
  }
}

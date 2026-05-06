import { Controller, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '@terab/common';
import { contract } from '@terab/contract';
import { tsRestHandler, TsRestHandler } from '@ts-rest/nest';
import { type AuthUser } from '../auth/types/auth-user.type';
import { FolderService } from './folder.service';

@Controller()
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @TsRestHandler(contract.folder.getRoot)
  handleGetRoot(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.getRoot, async () => {
      const result = await this.folderService.getRoot(user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.getChildren)
  handleGetChildren(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.getChildren, async ({ params }) => {
      const result = await this.folderService.getChildren(params.id, user.userId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.create)
  handleCreate(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.create, async ({ body }) => {
      const result = await this.folderService.create(user.userId, body.name, body.parentId);
      return { status: HttpStatus.CREATED, body: result };
    });
  }

  @TsRestHandler(contract.folder.rename)
  handleRename(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.rename, async ({ params, body }) => {
      const result = await this.folderService.rename(params.id, user.userId, body.name);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.move)
  handleMove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.move, async ({ params, body }) => {
      const result = await this.folderService.move(params.id, user.userId, body.parentId);
      return { status: HttpStatus.OK, body: result };
    });
  }

  @TsRestHandler(contract.folder.remove)
  handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.folder.remove, async ({ params }) => {
      await this.folderService.remove(params.id, user.userId);
      return { status: HttpStatus.NO_CONTENT, body: undefined };
    });
  }
}

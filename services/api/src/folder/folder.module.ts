import { Module } from '@nestjs/common';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

@Module({
  controllers: [FolderController],
  providers: [FolderService, FolderRepository],
  exports: [FolderService],
})
export class FolderModule {}

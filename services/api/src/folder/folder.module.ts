import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';

@Module({
  imports: [FileModule],
  controllers: [FolderController],
  providers: [FolderService, FolderRepository],
  exports: [FolderService],
})
export class FolderModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FolderModule } from '../folder/folder.module';
import { FileDownloadController } from './file-download.controller';
import { FileUploadController } from './file-upload.controller';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { UploadSessionCleanupWorker } from './upload-session.cleanup.worker';
import { UploadSessionRepository } from './upload-session.repository';
import { UploadSessionService } from './upload-session.service';

@Module({
  imports: [FolderModule, BullModule.registerQueue({ name: 'upload-session-cleanup' })],
  controllers: [FileController, FileDownloadController, FileUploadController],
  providers: [FileService, FileRepository, UploadSessionRepository, UploadSessionService, UploadSessionCleanupWorker],
  exports: [FileService],
})
export class FileModule {}

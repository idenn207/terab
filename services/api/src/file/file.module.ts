import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FolderModule } from '../folder/folder.module';
import { MinioStorageEngine } from '../minio/minio-storage.engine';
import { MinioService } from '../minio/minio.service';
import { FileDownloadController } from './file-download.controller';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { UploadSessionRepository } from './upload-session.repository';
import { UploadSessionService } from './upload-session.service';
import { FileUploadController } from './file-upload.controller';

@Module({
  imports: [
    FolderModule,
    MulterModule.registerAsync({
      inject: [MinioService],
      useFactory: (minioService: MinioService) => ({
        storage: new MinioStorageEngine(minioService),
      }),
    }),
  ],
  controllers: [FileController, FileDownloadController, FileUploadController],
  providers: [FileService, FileRepository, UploadSessionRepository, UploadSessionService],
  exports: [FileService, UploadSessionRepository],
})
export class FileModule {}

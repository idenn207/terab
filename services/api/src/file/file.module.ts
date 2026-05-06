import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MinioStorageEngine } from '../minio/minio-storage.engine';
import { MinioService } from '../minio/minio.service';
import { FileDownloadController } from './file-download.controller';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [MinioService],
      useFactory: (minioService: MinioService) => ({
        storage: new MinioStorageEngine(minioService),
      }),
    }),
  ],
  controllers: [FileController, FileDownloadController],
  providers: [FileService, FileRepository],
  exports: [FileService],
})
export class FileModule {}

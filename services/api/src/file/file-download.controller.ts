import { Body, Controller, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiException, CurrentUser, type AuthUser } from '@terab/common';
import archiver from 'archiver';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { FileService } from './file.service';

@Controller()
export class FileDownloadController {
  private readonly ZIP_LIMIT = 100;
  constructor(private readonly fileService: FileService) {}

  // archiver가 해당 엔트리를 처리할 시점에만 MinIO 연결을 여는 lazy 스트림
  private lazyStream(factory: () => Promise<Readable>): Readable {
    let source: Readable | null = null;
    let connected = false;
    return new Readable({
      read() {
        if (source) {
          source.resume();
        } else if (!connected) {
          connected = true;
          factory()
            .then((s) => {
              source = s;
              s.on('data', (chunk) => {
                if (!this.push(chunk)) s.pause();
              });
              s.on('end', () => this.push(null));
              s.on('error', (err) => this.destroy(err));
            })
            .catch((err) => this.destroy(err as Error));
        }
      },
    });
  }

  @Get('/files/:id/download')
  async downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, name, size, mimeType } = await this.fileService.getDownloadStream(user.userId, id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      'Content-Length': String(size),
    });
    return new StreamableFile(stream);
  }

  @Post('/files/download/zip')
  async downloadZip(
    @CurrentUser() user: AuthUser,
    @Body() body: { fileIds: string[] },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!body.fileIds || body.fileIds.length > this.ZIP_LIMIT) {
      throw new ApiException('ZIP_LIMIT_EXCEEDED');
    }

    const files = await this.fileService.resolveZipFiles(body.fileIds, user.userId);

    const archive = archiver('zip', { zlib: { level: 1 } });

    for (const { name, key } of files) {
      archive.append(
        this.lazyStream(() => this.fileService.getObjectStream(key)),
        { name },
      );
    }

    void archive.finalize();

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="download.zip"',
    });

    return new StreamableFile(archive);
  }
}

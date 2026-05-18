import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import archiver from 'archiver';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { ZipDownloadBodyDto } from './dto';
import { FileService } from './file.service';

@Controller()
@ApiTags('File')
export class FileDownloadController {
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
  @ApiOperation({ summary: '파일 다운로드' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: HttpStatus.OK, schema: { type: 'string', format: 'binary' } })
  @ApiError('FILE_NOT_FOUND')
  async downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
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
  @ApiOperation({ summary: 'ZIP 다운로드' })
  @ApiProduces('application/zip')
  @ApiResponse({ status: HttpStatus.OK, schema: { type: 'string', format: 'binary' } })
  @ApiError('FILE_NOT_FOUND')
  async downloadZip(
    @CurrentUser() user: AuthUser,
    @Body() body: ZipDownloadBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
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

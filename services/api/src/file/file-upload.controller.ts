import { Body, Controller, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import {
  FileItemDto,
  UploadCompleteBodyDto,
  UploadInitBodyDto,
  UploadInitResponseDto,
} from './dto';
import { UploadSessionService } from './upload-session.service';

@Controller('files')
@ApiTags('File')
export class FileUploadController {
  constructor(private readonly uploadSessionService: UploadSessionService) {}

  @Post('upload-init')
  @ApiOperation({ summary: '파일 업로드 세션 생성 (presigned URL 발급)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: UploadInitResponseDto })
  @ApiError('FOLDER_NOT_FOUND', 'FILE_TOO_LARGE')
  async init(
    @CurrentUser() user: AuthUser,
    @Body() body: UploadInitBodyDto,
  ): Promise<UploadInitResponseDto> {
    return this.uploadSessionService.init(user.userId, body);
  }

  @Post(':sessionId/upload-complete')
  @ApiOperation({ summary: '파일 업로드 완료 (DB 반영)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FileItemDto })
  @ApiError('UPLOAD_SESSION_NOT_FOUND', 'UPLOAD_SESSION_EXPIRED', 'UPLOAD_OBJECT_MISSING', 'UPLOAD_SIZE_MISMATCH')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: UploadCompleteBodyDto,
  ): Promise<FileItemDto> {
    return this.uploadSessionService.complete(user.userId, sessionId, body.parts);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { FileItemDto, FileSearchQueryDto, FileSearchResponseDto, MoveFileBodyDto, RenameFileBodyDto } from './dto';
import { FileService } from './file.service';

@Controller('files')
@ApiTags('File')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('search')
  @ApiOperation({ summary: '파일 검색' })
  @ApiResponse({ status: HttpStatus.OK, type: FileSearchResponseDto })
  @ApiError('FOLDER_NOT_FOUND')
  async search(@CurrentUser() user: AuthUser, @Query() query: FileSearchQueryDto): Promise<FileSearchResponseDto> {
    return this.fileService.search(user.userId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: '파일 이름 변경' })
  @ApiResponse({ status: HttpStatus.OK, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.rename(user.userId, id, body);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '파일 이동' })
  @ApiResponse({ status: HttpStatus.OK, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.move(user.userId, id, body);
  }

  @Post(':id/copy')
  @ApiOperation({ summary: '파일 복사' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FileItemDto })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND')
  async copy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFileBodyDto,
  ): Promise<FileItemDto> {
    return this.fileService.copy(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 소프트 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.fileService.remove(user.userId, id);
  }
}

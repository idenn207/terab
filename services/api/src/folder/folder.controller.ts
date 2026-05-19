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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import {
  CreateFolderBodyDto,
  FolderChildrenResponseDto,
  FolderItemDto,
  MoveFolderBodyDto,
  RenameFolderBodyDto,
} from './dto';
import { FolderService } from './folder.service';

@Controller('folders')
@ApiTags('Folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get('root')
  @ApiOperation({ summary: '루트 폴더 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderChildrenResponseDto })
  async getRoot(@CurrentUser() user: AuthUser): Promise<FolderChildrenResponseDto> {
    return this.folderService.getRoot(user.userId);
  }

  @Get(':id/children')
  @ApiOperation({ summary: '서브폴더 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderChildrenResponseDto })
  @ApiError('FOLDER_NOT_FOUND')
  async getChildren(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderChildrenResponseDto> {
    return this.folderService.getChildren(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: '폴더 생성' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND', 'FOLDER_DEPTH_EXCEEDED')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.create(user.userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '폴더 이름 변경' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.rename(user.userId, id, body);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '폴더 이동' })
  @ApiResponse({ status: HttpStatus.OK, type: FolderItemDto })
  @ApiError('FOLDER_NOT_FOUND', 'INVALID_MOVE_TARGET')
  async move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveFolderBodyDto,
  ): Promise<FolderItemDto> {
    return this.folderService.move(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '폴더 소프트 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FOLDER_NOT_FOUND')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.folderService.remove(user.userId, id);
  }
}

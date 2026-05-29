import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { TrashActionBodyDto, TrashListResponseDto } from './dto';
import { TrashService } from './trash.service';

@Controller('trash')
@ApiTags('Trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: '휴지통 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: TrashListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<TrashListResponseDto> {
    return this.trashService.list(user.userId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '휴지통 항목 복원' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND', 'PARENT_IN_TRASH')
  async restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrashActionBodyDto,
  ): Promise<void> {
    await this.trashService.restore(user.userId, id, body.type);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '영구 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('FILE_NOT_FOUND', 'FOLDER_NOT_FOUND', 'PARENT_IN_TRASH')
  async permanentDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrashActionBodyDto,
  ): Promise<void> {
    await this.trashService.permanentDelete(user.userId, id, body.type);
  }
}

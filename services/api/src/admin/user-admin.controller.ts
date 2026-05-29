import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '@terab/common';
import { UserService } from '../user/user.service';
import { AdminUserListResponseDto, ListUsersQueryDto } from './dto';

@Controller('admin/users')
@ApiTags('AdminUser')
export class UserAdminController {
  constructor(private readonly userService: UserService) {}

  @RequirePermission('user:read')
  @Get()
  @ApiOperation({ summary: '관리자 — 사용자 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserListResponseDto })
  async list(@Query() query: ListUsersQueryDto): Promise<AdminUserListResponseDto> {
    return this.userService.listUsers(query);
  }
}

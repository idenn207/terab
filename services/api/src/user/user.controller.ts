import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, UserDto } from '@terab/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '현재 사용자 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiError('INVALID_CREDENTIALS')
  async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.userService.getCurrentUser(user.userId);
  }
}

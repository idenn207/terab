import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  username!: string;

  nickname!: string;

  @ApiProperty({ type: [String], description: '사용자가 보유한 RBAC permission 키 목록 (예: file:read, user:manage).' })
  permissions!: string[];
}

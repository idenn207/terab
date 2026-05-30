import { ApiProperty } from '@nestjs/swagger';

export class AdminUserListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  username!: string;

  nickname!: string;

  createdAt!: Date;

  roleNames!: string[];
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: AdminUserListItemDto, isArray: true })
  items!: AdminUserListItemDto[];

  total!: number;

  limit!: number;

  offset!: number;
}

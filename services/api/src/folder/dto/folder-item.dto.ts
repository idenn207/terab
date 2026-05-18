import { ApiProperty } from '@nestjs/swagger';

export class FolderItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentId!: string | null;

  createdAt!: Date;

  updatedAt!: Date;
}

import { ApiProperty } from '@nestjs/swagger';

export class TrashItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['file', 'folder'] })
  type!: 'file' | 'folder';

  name!: string;

  deletedAt!: Date;
}

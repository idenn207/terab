import { ApiProperty } from '@nestjs/swagger';

export class TrashItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['file', 'folder'] })
  type!: 'file' | 'folder';

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'date-time', type: String })
  deletedAt!: Date;
}

import { ApiProperty } from '@nestjs/swagger';

export class FileItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

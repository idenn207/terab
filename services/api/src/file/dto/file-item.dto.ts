import { ApiProperty } from '@nestjs/swagger';

export class FileItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  folderId!: string | null;

  size!: number;

  mimeType!: string;

  createdAt!: Date;

  updatedAt!: Date;
}

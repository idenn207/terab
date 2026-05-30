import { ApiProperty } from '@nestjs/swagger';
import type { Drives$Select } from '@terab/db';

export class DriveDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ enum: ['PRIVATE'] })
  kind!: 'PRIVATE';

  mountPath!: string;

  createdAt!: Date;
}

export function toDriveDto(drive: Drives$Select): DriveDto {
  return {
    id: drive.id,
    name: drive.name,
    kind: drive.kind as 'PRIVATE',
    mountPath: drive.mountPath,
    createdAt: drive.createdAt,
  };
}

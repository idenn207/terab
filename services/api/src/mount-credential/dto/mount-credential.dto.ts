import { ApiProperty } from '@nestjs/swagger';
import type { MountCredentials$Select } from '@terab/db';

export class MountCredentialDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  driveId!: string;

  @ApiProperty({ enum: ['iscsi'] })
  protocol!: 'iscsi';

  osUsername!: string;

  @ApiProperty({ type: String, nullable: true })
  iqn!: string | null;

  portalHost!: string;

  portalPort!: number;

  createdAt!: Date;
}

export function toMountCredentialDto(
  row: MountCredentials$Select,
  portal: { host: string; port: number },
): MountCredentialDto {
  return {
    id: row.id,
    driveId: row.driveId,
    protocol: row.protocol as 'iscsi',
    osUsername: row.osUsername,
    iqn: row.iqn,
    portalHost: portal.host,
    portalPort: portal.port,
    createdAt: row.createdAt,
  };
}

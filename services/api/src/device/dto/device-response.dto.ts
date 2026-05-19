import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  userAgent?: string;

  createdAt!: Date;
}

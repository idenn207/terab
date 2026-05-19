import { ApiProperty } from '@nestjs/swagger';

export class TrustedDeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  userAgent?: string;

  createdAt!: Date;
}

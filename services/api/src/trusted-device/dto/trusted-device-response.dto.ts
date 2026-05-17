import { ApiProperty } from '@nestjs/swagger';

export class TrustedDeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

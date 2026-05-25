import { ApiProperty } from '@nestjs/swagger';

export class TotpInstanceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt!: Date | null;
}

export class TotpListResponseDto {
  @ApiProperty({ type: TotpInstanceDto, isArray: true })
  instances!: TotpInstanceDto[];
}

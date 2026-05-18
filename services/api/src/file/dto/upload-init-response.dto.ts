import { ApiProperty } from '@nestjs/swagger';

export class UploadPartDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 10000 })
  partNumber!: number;

  @ApiProperty({ format: 'uri' })
  uploadUrl!: string;
}

export class UploadInitResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ type: UploadPartDto, isArray: true, minItems: 1 })
  parts!: UploadPartDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  uploadHeaders!: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

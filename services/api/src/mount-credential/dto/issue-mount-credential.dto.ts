import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class IssueMountCredentialDto {
  @ApiPropertyOptional({ format: 'uuid', description: '미지정 시 본인 personal drive 사용' })
  @IsOptional()
  @IsUUID()
  driveId?: string;
}

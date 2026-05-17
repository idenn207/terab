import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveFolderBodyDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}

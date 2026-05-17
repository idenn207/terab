import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateFolderBodyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}

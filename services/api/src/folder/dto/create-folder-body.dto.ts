import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateFolderBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}

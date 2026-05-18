import { IsUUID, ValidateIf } from 'class-validator';

export class MoveFolderBodyDto {
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId!: string | null;
}

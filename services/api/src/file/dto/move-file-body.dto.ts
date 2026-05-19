import { IsUUID, ValidateIf } from 'class-validator';

export class MoveFileBodyDto {
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  folderId!: string | null;
}

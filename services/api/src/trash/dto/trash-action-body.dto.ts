import { IsEnum } from 'class-validator';

export class TrashActionBodyDto {
  @IsEnum(['file', 'folder'])
  type!: 'file' | 'folder';
}

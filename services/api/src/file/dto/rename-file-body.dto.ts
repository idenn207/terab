import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameFileBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UploadCompletePartDto {
  @ApiProperty({ type: 'integer' })
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  etag!: string;
}

export class UploadCompleteBodyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadCompletePartDto)
  parts!: UploadCompletePartDto[];
}

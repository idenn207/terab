import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class UploadCompletePartDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber!: number;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  etag!: string;
}

export class UploadCompleteBodyDto {
  @ApiProperty({ type: UploadCompletePartDto, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadCompletePartDto)
  parts!: UploadCompletePartDto[];
}

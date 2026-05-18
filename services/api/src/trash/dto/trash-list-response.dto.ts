import { ApiProperty } from '@nestjs/swagger';
import { TrashItemDto } from './trash-item.dto';

export class TrashListResponseDto {
  @ApiProperty({ type: TrashItemDto, isArray: true })
  items!: TrashItemDto[];
}

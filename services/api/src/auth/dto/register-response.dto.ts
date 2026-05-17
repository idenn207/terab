import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class RegisterResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: [String] })
  backupCodes!: string[];
}

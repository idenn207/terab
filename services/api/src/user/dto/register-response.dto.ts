import { UserDto } from '../../common/dto';

export class RegisterResponseDto {
  accessToken!: string;

  user!: UserDto;

  backupCodes!: string[];
}

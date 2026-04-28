import { UserResponseDto } from './user-response.dto';

export class RegisterResponseDto {
  accessToken!: string;
  user!: UserResponseDto;
  backupCodes!: string[];
}

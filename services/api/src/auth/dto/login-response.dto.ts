import { UserResponseDto } from './user-response.dto.js';

export class LoginResponseDto {
  status: 'AUTHENTICATED' | '2FA_REQUIRED';
  accessToken?: string;
  user?: UserResponseDto;

  static authenticated(accessToken: string, user: UserResponseDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = 'AUTHENTICATED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }
}

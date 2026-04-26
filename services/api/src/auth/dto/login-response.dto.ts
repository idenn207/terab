import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  status!: 'AUTHENTICATED' | '2FA_REQUIRED';
  accessToken?: string;
  user?: UserResponseDto;
  challengeId?: string;
  options?: string[];
  expiresAt?: Date;

  static authenticated(accessToken: string, user: UserResponseDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = 'AUTHENTICATED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }

  static twoFactorRequired(challengeId: string, options: string[], expiresAt: Date): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.status = '2FA_REQUIRED';
    dto.challengeId = challengeId;
    dto.options = options;
    dto.expiresAt = expiresAt;
    return dto;
  }
}

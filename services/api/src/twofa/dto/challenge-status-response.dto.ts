import type { UserResponseDto } from '../../auth/dto/user-response.dto';

export class ChallengeStatusResponseDto {
  status!: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  options?: string[];
  remainingSeconds?: number;
  accessToken?: string;
  user?: UserResponseDto;

  static pending(options: string[], remainingSeconds: number): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'PENDING';
    dto.options = options;
    dto.remainingSeconds = remainingSeconds;
    return dto;
  }

  static approved(accessToken: string, user: UserResponseDto): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'APPROVED';
    dto.accessToken = accessToken;
    dto.user = user;
    return dto;
  }

  static denied(): ChallengeStatusResponseDto {
    const dto = new ChallengeStatusResponseDto();
    dto.status = 'DENIED';
    return dto;
  }
}

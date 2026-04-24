import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDefinition {
  message: string;
  status: HttpStatus;
}

export const ErrorCode = {
  INVALID_CREDENTIALS: {
    message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  TOKEN_EXPIRED: {
    message: '토큰이 만료되었습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  TOKEN_INVALID: {
    message: '유효하지 않은 토큰입니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  REFRESH_TOKEN_INVALID: {
    message: 'Refresh Token이 유효하지 않습니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  FORBIDDEN: {
    message: '접근 권한이 없습니다.',
    status: HttpStatus.FORBIDDEN,
  },
  USERNAME_TAKEN: {
    message: '이미 사용 중인 아이디입니다.',
    status: HttpStatus.CONFLICT,
  },
  ACCOUNT_DISABLED: {
    message: '비활성화된 계정입니다.',
    status: HttpStatus.LOCKED,
  },
  BACKUP_CODE_INVALID: {
    message: '유효하지 않은 백업 코드입니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCodeKey = keyof typeof ErrorCode;

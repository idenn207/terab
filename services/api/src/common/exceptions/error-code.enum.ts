import { HttpStatus } from '@nestjs/common';

export const HttpStatusMessage: Partial<Record<HttpStatus | number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

export interface ErrorCodeDefinition {
  message: string;
  status: HttpStatus;
}

export const ErrorCode = {
  // ───── Login ──────────────────────────────
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
  ROLE_NOT_FOUND: {
    message: '역할 정보를 찾을 수 없습니다. 관리자에게 문의하세요.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  REGISTRATION_FAILED: {
    message: '회원가입 중 오류가 발생했습니다.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  // ───── 2FA ──────────────────────────────
  BACKUP_CODE_INVALID: {
    message: '유효하지 않은 백업 코드입니다.',
    status: HttpStatus.UNAUTHORIZED,
  },
  TWO_FA_CHALLENGE_NOT_FOUND: {
    message: '2FA 챌린지를 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  DEVICE_NOT_FOUND: {
    message: '등록되지 않은 디바이스입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  TRUSTED_DEVICE_NOT_FOUND: {
    message: '등록되지 않은 신뢰기기입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  // ───── Invitation ──────────────────────────────
  INVITATION_NOT_FOUND: {
    message: '유효하지 않은 초대 링크입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  INVITATION_EXPIRED: {
    message: '만료된 초대 링크입니다.',
    status: HttpStatus.GONE,
  },
  INVITATION_ALREADY_USED: {
    message: '이미 사용된 초대 링크입니다.',
    status: HttpStatus.CONFLICT,
  },
  // ───── Folder/File ──────────────────────────────
  FILE_NOT_FOUND: {
    message: '파일을 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  FOLDER_NOT_FOUND: {
    message: '폴더를 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  FILE_UPLOAD_FAILED: {
    message: '파일 업로드에 실패했습니다.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  FILE_ALREADY_DELETED: {
    message: '이미 삭제된 파일입니다.',
    status: HttpStatus.CONFLICT,
  },
  FOLDER_ALREADY_DELETED: {
    message: '이미 삭제된 폴더입니다.',
    status: HttpStatus.CONFLICT,
  },
  INVALID_MOVE_TARGET: {
    message: '하위 폴더로 이동할 수 없습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  FOLDER_DEPTH_EXCEEDED: {
    message: '폴더 중첩 깊이 한도를 초과했습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  ZIP_LIMIT_EXCEEDED: {
    message: 'ZIP 다운로드는 최대 100개까지 가능합니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  // ───── Upload Session ──────────────────────────────
  FILE_TOO_LARGE: {
    message: '파일 크기가 한도(100GB)를 초과했습니다.',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
  },
  UPLOAD_SESSION_NOT_FOUND: {
    message: '업로드 세션을 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  UPLOAD_SESSION_EXPIRED: {
    message: '업로드 세션이 만료됐습니다.',
    status: HttpStatus.GONE,
  },
  UPLOAD_OBJECT_MISSING: {
    message: '업로드된 파일을 찾을 수 없습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  UPLOAD_SIZE_MISMATCH: {
    message: '업로드된 파일 크기가 선언값과 다릅니다.',
    status: HttpStatus.BAD_REQUEST,
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCodeKey = keyof typeof ErrorCode;

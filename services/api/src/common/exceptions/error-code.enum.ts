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
  TWOFA_CHALLENGE_NOT_FOUND: {
    message: '2FA 챌린지를 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  TWOFA_STRATEGY_NOT_FOUND: {
    message: '등록되지 않은 2FA 방식입니다.',
    status: HttpStatus.NOT_FOUND,
  },
  TWOFA_SETUP_NOT_SUPPORTED: {
    message: '해당 2FA 방식은 별도 등록 절차가 없습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  TWOFA_TOTP_INVALID_CODE: {
    message: 'TOTP 코드가 올바르지 않습니다.',
    status: HttpStatus.BAD_REQUEST,
  },
  TWOFA_TOTP_LOCKED: {
    message: 'TOTP 입력 실패 횟수가 한도를 초과해 잠겼습니다. 잠시 후 다시 시도하세요.',
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  TWOFA_LAST_STRATEGY_CANNOT_REMOVE: {
    message: '마지막 2FA 방식은 제거할 수 없습니다. backup code 또는 다른 방식을 먼저 추가하세요.',
    status: HttpStatus.BAD_REQUEST,
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
  // ───── Storage Agent (iSCSI sidecar) ──────────────────────────────
  STORAGE_AGENT_UNAVAILABLE: {
    message: '스토리지 에이전트에 연결할 수 없습니다.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  STORAGE_AGENT_TARGET_CONFLICT: {
    message: '이미 동일한 IQN의 iSCSI 타깃이 존재합니다.',
    status: HttpStatus.CONFLICT,
  },
  STORAGE_AGENT_TARGET_NOT_FOUND: {
    message: '해당 IQN의 iSCSI 타깃을 찾을 수 없습니다.',
    status: HttpStatus.NOT_FOUND,
  },
  STORAGE_AGENT_INTERNAL: {
    message: '스토리지 에이전트 내부 오류가 발생했습니다.',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCodeKey = keyof typeof ErrorCode;

const FORM_ERROR_MESSAGES = {
  USERNAME_REQUIRED: '아이디를 입력해주세요',
  PASSWORD_REQUIRED: '비밀번호를 입력해주세요',
  BACKUP_CODE_REQUIRED: '백업코드를 입력해주세요',
  BACKUP_CODE_INVALID_PATTERN: '형식이 올바르지 않습니다. (예: A3K9-MZ7P)',
} as const;

const API_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않습니다',
  ACCOUNT_DISABLED: '비활성화된 계정입니다',
  BACKUP_CODE_INVALID: '유효하지 않은 백업 코드입니다',
  UNKNOWN: '로그인에 실패했습니다',
} as const;

type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

const TWO_FACTOR_ERROR_MESSAGES = { ...FORM_ERROR_MESSAGES, ...API_ERROR_MESSAGES } as const;

export { TWO_FACTOR_ERROR_MESSAGES };
export type { ApiErrorCode };

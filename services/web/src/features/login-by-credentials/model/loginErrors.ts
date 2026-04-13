const FORM_ERROR_MESSAGES = {
  USERNAME_REQUIRED: 'ID를 입력해주세요',
  PASSWORD_REQUIRED: '비밀번호를 입력해주세요',
} as const;

const API_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'ID 또는 비밀번호가 올바르지 않습니다',
  UNKNOWN: '로그인에 실패했습니다',
} as const;

type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

const LOGIN_ERROR_MESSAGES = { ...FORM_ERROR_MESSAGES, ...API_ERROR_MESSAGES } as const;

export { LOGIN_ERROR_MESSAGES };
export type { ApiErrorCode };

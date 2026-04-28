const FORM_ERROR_MESSAGES = {
  USERNAME_REQUIRED: '아이디를 입력해주세요',
  NICKNAME_REQUIRED: '닉네임을 입력해주세요',
  PASSWORD_REQUIRED: '비밀번호를 입력해주세요',
  PASSWORD_MIN_LENGTH: '비밀번호는 8자 이상이어야 합니다',
  PASSWORD_CONFIRM_REQUIRED: '비밀번호 확인를 입력해주세요',
  PASSWORD_CONFIRM_NOT_VALIDE: '비밀번호가 일치하지 않습니다',
} as const;

const API_ERROR_MESSAGES = {
  INVITATION_NOT_FOUND: '유효하지 않은 초대 링크입니다',
  INVITATION_ALREADY_USED: '이미 사용된 초대 링크입니다',
  INVITATION_EXPIRED: '만료된 초대 링크입니다',
  USERNAME_TAKEN: '이미 사용 중인 아이디입니다',
  UNKNOWN: '로그인에 실패했습니다',
} as const;

type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

const REGISTER_ERROR_MESSAGES = { ...FORM_ERROR_MESSAGES, ...API_ERROR_MESSAGES } as const;

export { REGISTER_ERROR_MESSAGES };
export type { ApiErrorCode };

package com.terab.api.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
  // Login/Auth
  INVALID_CREDENTIALS("아이디 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED),
  TOKEN_EXPIRED("토큰이 만료되었습니다.", HttpStatus.UNAUTHORIZED),
  TOKEN_INVALID("유효하지 않은 토큰입니다.", HttpStatus.UNAUTHORIZED),
  REFRESH_TOKEN_INVALID("Refresh Token이 유효하지 않습니다.", HttpStatus.UNAUTHORIZED),
  FORBIDDEN("접근 권한이 없습니다.", HttpStatus.FORBIDDEN),
  USERNAME_TAKEN("이미 사용 중인 아이디입니다.", HttpStatus.CONFLICT),
  ACCOUNT_DISABLED("비활성화된 계정입니다.", HttpStatus.LOCKED),
  TWO_FA_CHALLENGE_NOT_FOUND("2FA 챌린지를 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
  BACKUP_CODE_INVALID("유효하지 않은 백업 코드입니다.", HttpStatus.UNAUTHORIZED),
  TRUSTED_DEVICE_NOT_FOUND("등록되지 않은 신뢰기기입니다.", HttpStatus.NOT_FOUND);

  private final String message;
  private final HttpStatus status;

  ErrorCode(String message, HttpStatus status) {
    this.message = message;
    this.status = status;
  }

  public String getMessage() { return message; }
  public HttpStatus getStatus() { return status; }
}
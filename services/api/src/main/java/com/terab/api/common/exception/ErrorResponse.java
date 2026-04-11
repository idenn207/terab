package com.terab.api.common.exception;

import java.time.OffsetDateTime;

public record ErrorResponse(String code, String message, String timestamp) {

  public static ErrorResponse of(ErrorCode errorCode) {
    return new ErrorResponse(
      errorCode.name(),
      errorCode.getMessage(),
      OffsetDateTime.now().toString()
    );
  }

  public static ErrorResponse of(String code, String message) {
    return new ErrorResponse(code, message, OffsetDateTime.now().toString());
  }
}

package com.terab.api.auth.dto;

public record AuthResult(LoginResponse response, String rawRefreshToken, long refreshTokenExpMs) {

  public static AuthResult withToken(LoginResponse response, String rawRefreshToken, long refreshTokenExpMs) {
    return new AuthResult(response, rawRefreshToken, refreshTokenExpMs);
  }

  public static AuthResult withoutToken(LoginResponse response) {
    return new AuthResult(response, null, 0);
  }

  public boolean hasRefreshToken() {
    return rawRefreshToken != null;
  }
}

package com.terab.api.auth.application;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;

public class LogoutUseCase implements ILogoutUseCase {

  private AuthService authService;

  @Transactional
  @Override
  public void execute(String rawRefreshToken, HttpServletResponse response) {
    authService.revokeRefreshToken(rawRefreshToken);
    clearRefreshTokenCookie(response);

  }

  private void clearRefreshTokenCookie(HttpServletResponse response) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(0)
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}

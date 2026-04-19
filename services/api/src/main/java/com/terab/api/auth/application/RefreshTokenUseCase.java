package com.terab.api.auth.application;

import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.user.domain.User;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RefreshTokenUseCase implements IRefreshTokenUseCase {

  private final AuthService authService;

  @Transactional
  @Override
  public LoginResponse execute(String rawRefreshToken, HttpServletResponse response) {
    User user = authService.rotateRefreshToken(rawRefreshToken);
    String accessToken = authService.generateAccessToken(user);
    String newRawRefreshToken = authService.issueRefreshToken(user);
    setRefreshTokenCookie(response, newRawRefreshToken);

    return LoginResponse.authenticated(
      accessToken,
      new UserResponse(user.getId(), user.getUsername(), user.getNickname())
    );
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String rawToken) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", rawToken)
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(Duration.ofMillis(authService.getRefreshTokenExpMs()))
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}

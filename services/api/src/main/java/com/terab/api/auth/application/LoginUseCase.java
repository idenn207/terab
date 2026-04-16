package com.terab.api.auth.application;

import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LoginUseCase implements ILoginUseCase {

  private final UserService userService;
  private final AuthService authService;

  @Transactional
  @Override
  public LoginResponse execute(LoginRequest request, HttpServletResponse response) {
    User user = userService.findByUsername(request.username());
    authService.validateCredentials(user, request.password());
    String accessToken = authService.generateAccessToken(user);
    String rawRefreshToken = authService.issueRefreshToken(user);
    setRefreshTokenCookie(response, rawRefreshToken);

    return new LoginResponse(
      accessToken,
      new UserResponse(user.getId(), user.getUsername(), user.getNickname())
    );
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String rawRefreshToken) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", rawRefreshToken)
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(Duration.ofMillis((authService.getRefreshTokenExpMs())))
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}

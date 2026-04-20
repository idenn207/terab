package com.terab.api.auth.controller;

import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

  private final ILoginUseCase loginUseCase;
  private final IRefreshTokenUseCase refreshTokenUseCase;
  private final ILogoutUseCase logoutUseCase;
  private final IGetCurrentUserUseCase getCurrentUserUseCase;

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(
    @RequestBody @Valid LoginRequest request,
    @CookieValue(required = false) String trustToken,
    HttpServletResponse response
  ) {
    AuthResult result = loginUseCase.execute(request, trustToken);
    if (result.hasRefreshToken()) {
      setRefreshTokenCookie(response, result.rawRefreshToken(), result.refreshTokenExpMs());
    }
    return ResponseEntity.ok(result.response());
  }

  @PostMapping("/refresh")
  public ResponseEntity<LoginResponse> refresh(
    @CookieValue(required = false) String refreshToken,
    HttpServletResponse response
  ) {
    AuthResult result = refreshTokenUseCase.execute(refreshToken);
    setRefreshTokenCookie(response, result.rawRefreshToken(), result.refreshTokenExpMs());
    return ResponseEntity.ok(result.response());
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
    @CookieValue(required = false) String refreshToken,
    HttpServletResponse response
  ) {
    logoutUseCase.execute(refreshToken);
    clearRefreshTokenCookie(response);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  public ResponseEntity<UserResponse> me(
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(getCurrentUserUseCase.execute(userDetails.getUserId()));
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String rawToken, long expMs) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", rawToken)
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(Duration.ofMillis(expMs))
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
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

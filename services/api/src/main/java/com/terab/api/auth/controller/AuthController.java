package com.terab.api.auth.controller;

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
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
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
    HttpServletResponse response
  ) {
    return ResponseEntity.ok(loginUseCase.execute(request, response));
  }

  @PostMapping("/refresh")
  public ResponseEntity<LoginResponse> refresh(
    @CookieValue(name = "refreshToken", required = false) String refreshToken,
    HttpServletResponse response
  ) {
    if (refreshToken == null) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    return ResponseEntity.ok(refreshTokenUseCase.execute(refreshToken, response));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
    @CookieValue(name = "refreshToken", required = false) String refreshToken,
    HttpServletResponse response
  ) {
    logoutUseCase.execute(refreshToken, response);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  public ResponseEntity<UserResponse> me(
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(getCurrentUserUseCase.execute(userDetails.getUserId()));
  }
}

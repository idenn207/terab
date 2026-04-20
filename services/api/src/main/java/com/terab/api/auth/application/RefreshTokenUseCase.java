package com.terab.api.auth.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RefreshTokenUseCase implements IRefreshTokenUseCase {

  private final AuthService authService;

  @Transactional
  @Override
  public AuthResult execute(String rawRefreshToken) {
    User user = authService.rotateRefreshToken(rawRefreshToken);
    String accessToken = authService.generateAccessToken(user);
    String newRawRefreshToken = authService.issueRefreshToken(user);

    return AuthResult.withToken(
        LoginResponse.authenticated(accessToken, new UserResponse(user.getId(), user.getUsername(), user.getNickname())),
        newRawRefreshToken,
        authService.getRefreshTokenExpMs()
    );
  }
}

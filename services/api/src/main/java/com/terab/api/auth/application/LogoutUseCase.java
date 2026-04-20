package com.terab.api.auth.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.service.AuthService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LogoutUseCase implements ILogoutUseCase {

  private final AuthService authService;

  @Transactional
  @Override
  public void execute(String rawRefreshToken) {
    authService.revokeRefreshToken(rawRefreshToken);
  }
}

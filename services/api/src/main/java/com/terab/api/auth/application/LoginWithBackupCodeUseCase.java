package com.terab.api.auth.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILoginWithBackupCodeUseCase;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.BackupLoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.backupcode.service.BackupCodeService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LoginWithBackupCodeUseCase implements ILoginWithBackupCodeUseCase {
  
  private final UserService userService;
  private final AuthService authService;
  private final BackupCodeService backupCodeService;

  @Transactional
  @Override
  public AuthResult execute(BackupLoginRequest request) {
    User user = userService.findByUsername(request.username());
    authService.validateCredentials(user, request.password());

    if(!backupCodeService.verifyAndConsume(user, request.backupCode())) {
      throw new ApiException(ErrorCode.BACKUP_CODE_INVALID);
    }

    return issueTokens(user);
  }
  
  private AuthResult issueTokens(User user) {
    String accessToken = authService.generateAccessToken(user);
    String rawRefreshToken = authService.issueRefreshToken(user);

    return AuthResult.withToken(
        LoginResponse.authenticated(accessToken, new UserResponse(user.getId(), user.getUsername(), user.getNickname())),
        rawRefreshToken,
        authService.getRefreshTokenExpMs()
    );
  }

}

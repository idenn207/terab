package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.AuthResult;
import com.terab.api.common.usecase.UseCase;

public interface IRefreshTokenUseCase extends UseCase {
  AuthResult execute(String rawRefreshToken);
}

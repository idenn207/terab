package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface IRefreshTokenUseCase extends UseCase {
  LoginResponse execute(String rawRefreshToken, HttpServletResponse response);
}

package com.terab.api.auth.application.interfaces;

import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface ILogoutUseCase extends UseCase {
  void execute(String rawRefreshToken, HttpServletResponse response);
}

package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface ILoginUseCase extends UseCase {
  LoginResponse execute(LoginRequest request, HttpServletResponse response);
}

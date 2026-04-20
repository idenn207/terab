package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.common.usecase.UseCase;

public interface ILoginUseCase extends UseCase {
  AuthResult execute(LoginRequest request, String trustToken);
}

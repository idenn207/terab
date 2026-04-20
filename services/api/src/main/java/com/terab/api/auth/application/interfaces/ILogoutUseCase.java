package com.terab.api.auth.application.interfaces;

import com.terab.api.common.usecase.UseCase;

public interface ILogoutUseCase extends UseCase {
  void execute(String rawRefreshToken);
}

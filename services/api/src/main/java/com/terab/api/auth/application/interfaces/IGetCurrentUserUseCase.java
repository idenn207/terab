package com.terab.api.auth.application.interfaces;

import java.util.UUID;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.usecase.UseCase;

public interface IGetCurrentUserUseCase extends UseCase {
  UserResponse execute(UUID userId);
}

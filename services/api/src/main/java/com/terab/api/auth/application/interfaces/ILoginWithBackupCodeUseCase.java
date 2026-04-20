package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.BackupLoginRequest;
import com.terab.api.common.usecase.UseCase;

public interface ILoginWithBackupCodeUseCase extends UseCase {
  AuthResult execute(BackupLoginRequest request);
}

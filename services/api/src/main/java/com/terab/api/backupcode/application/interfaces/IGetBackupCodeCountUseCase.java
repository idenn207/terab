package com.terab.api.backupcode.application.interfaces;

import java.util.UUID;
import com.terab.api.backupcode.dto.BackupCodeCountResponse;
import com.terab.api.common.usecase.UseCase;

public interface IGetBackupCodeCountUseCase extends UseCase {
  BackupCodeCountResponse execute(UUID userId);
}

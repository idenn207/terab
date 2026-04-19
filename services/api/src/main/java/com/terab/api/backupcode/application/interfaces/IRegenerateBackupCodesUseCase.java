package com.terab.api.backupcode.application.interfaces;

import java.util.UUID;
import com.terab.api.backupcode.dto.BackupCodesResponse;
import com.terab.api.common.usecase.UseCase;

public interface IRegenerateBackupCodesUseCase extends UseCase {
  BackupCodesResponse execute(UUID userId);
}

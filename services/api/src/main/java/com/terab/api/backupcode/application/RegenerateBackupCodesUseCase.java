package com.terab.api.backupcode.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.backupcode.application.interfaces.IRegenerateBackupCodesUseCase;
import com.terab.api.backupcode.dto.BackupCodesResponse;
import com.terab.api.backupcode.service.BackupCodeService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RegenerateBackupCodesUseCase implements IRegenerateBackupCodesUseCase {

  private final UserService userService;
  private final BackupCodeService backupCodeService;

  @Transactional
  @Override
  public BackupCodesResponse execute(UUID userId) {
    User user = userService.findById(userId);
    return new BackupCodesResponse(backupCodeService.regenerate(user));
  }
}

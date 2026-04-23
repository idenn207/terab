package com.terab.api.backupcode.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.backupcode.application.interfaces.IGetBackupCodeCountUseCase;
import com.terab.api.backupcode.dto.BackupCodeCountResponse;
import com.terab.api.backupcode.service.BackupCodeService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GetBackupCodeCountUseCase implements IGetBackupCodeCountUseCase {

  private final UserService userService;
  private final BackupCodeService backupCodeService;

  @Transactional(readOnly = true)
  @Override
  public BackupCodeCountResponse execute(UUID userId) {
    User user = userService.findById(userId);
    return new BackupCodeCountResponse(backupCodeService.countUnused(user));
  }
}

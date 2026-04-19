package com.terab.api.backupcode.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.terab.api.backupcode.domain.BackupCode;
import com.terab.api.user.domain.User;

public interface BackupCodeRepository extends JpaRepository<BackupCode, UUID> {
  void deleteAllByUser(User user);
  List<BackupCode> findByUserAndUsedAtIsNull(User user);
  long countByUserAndUsedAtIsNull(User user);
}

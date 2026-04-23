package com.terab.api.backupcode.service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.backupcode.domain.BackupCode;
import com.terab.api.backupcode.repository.BackupCodeRepository;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BackupCodeService {
  
  private static final int CODE_COUNT = 8;
  private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  private final BackupCodeRepository repository;
  private final PasswordEncoder passwordEncoder;

  @Transactional
  public List<String> regenerate(User user) {
    repository.deleteAllByUser(user);
    List<String> plainCodes = new ArrayList<>();
    for (int i = 0; i < CODE_COUNT; i++) {
      String code = generateCode();
      plainCodes.add(code);
      BackupCode bc = new BackupCode();
      bc.setUser(user);
      bc.setCodeHash(passwordEncoder.encode(code));
      repository.save(bc);
    }
    return plainCodes;
  }

  @Transactional(readOnly = true)
  public long countUnused(User user) {
    return repository.countByUserAndUsedAtIsNull(user);
  }

  @Transactional
  public boolean verifyAndConsume(User user, String inputCode) {
    for (BackupCode bc : repository.findByUserAndUsedAtIsNull(user)) {
      if(passwordEncoder.matches(inputCode, bc.getCodeHash())) {
        bc.setUsedAt(OffsetDateTime.now());
        repository.save(bc);
        return true;
      }
    }
    return false;
  }

  private String generateCode() {
    SecureRandom rng = new SecureRandom();
    StringBuilder sb = new StringBuilder(9);
    for (int i = 0; i < 4; i++) sb.append(CODE_CHARS.charAt(rng.nextInt(CODE_CHARS.length())));
    sb.append('-');
    for (int i = 0; i < 4; i++) sb.append(CODE_CHARS.charAt(rng.nextInt(CODE_CHARS.length())));
    return sb.toString();
  }
}

package com.terab.api.backupcode.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.backupcode.application.interfaces.IGetBackupCodeCountUseCase;
import com.terab.api.backupcode.application.interfaces.IRegenerateBackupCodesUseCase;
import com.terab.api.backupcode.dto.BackupCodeCountResponse;
import com.terab.api.backupcode.dto.BackupCodesResponse;
import com.terab.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth/backup-codes")
@RequiredArgsConstructor
public class BackupCodeController {
  
  private final IRegenerateBackupCodesUseCase regenerateUseCase;
  private final IGetBackupCodeCountUseCase countUseCase;

  @PostMapping("/regenerate")
  public ResponseEntity<BackupCodesResponse> regenerate(@AuthenticationPrincipal CustomUserDetails userDetails) {
    return ResponseEntity.ok(regenerateUseCase.execute(userDetails.getUserId()));
  }

  @GetMapping("/count")
  public ResponseEntity<BackupCodeCountResponse> count(@AuthenticationPrincipal CustomUserDetails userDetails) {
    return ResponseEntity.ok(countUseCase.execute(userDetails.getUserId()));
  }
}

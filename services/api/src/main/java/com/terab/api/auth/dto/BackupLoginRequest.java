package com.terab.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;

@Builder
public record BackupLoginRequest(
  @NotBlank String username,
  @NotBlank String password,
  @NotBlank @Pattern(regexp = "[A-Z0-9]{4}-[A-Z0-9]{4}") String backupCpde
) {}

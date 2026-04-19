package com.terab.api.auth.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record LoginResponse(
  String status,
  String accessToken,
  UserResponse user,
  UUID challengeId,
  List<String> options,
  OffsetDateTime expiresAt
) {
  public static LoginResponse authenticated(String accessToken, UserResponse user) {
    return new LoginResponse(null, accessToken, user, null, null, null);
  }

  public static LoginResponse twoFactorRequired(UUID challengeId, List<String> options, OffsetDateTime expiresAt) {
    return new LoginResponse("2FA_REQUIRED", null, null, challengeId, options, expiresAt);
  }
}

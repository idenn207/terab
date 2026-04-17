package com.terab.notification.push.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PushChallengeEvent(
  UUID userId,
  String pushToken,
  String code,
  UUID challengeId,
  OffsetDateTime expiresAt
) {}

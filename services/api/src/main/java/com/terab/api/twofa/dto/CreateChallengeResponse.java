package com.terab.api.twofa.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreateChallengeResponse(UUID challengeId, List<String> options, OffsetDateTime expiresAt) {}

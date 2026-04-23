package com.terab.api.trusteddevice.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TrustedDeviceResponse(UUID id, String userAgent, OffsetDateTime expiresAt) {}

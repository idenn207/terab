package com.terab.api.auth.dto;

import java.util.UUID;

public record UserResponse(UUID id, String username, String nickname) {}

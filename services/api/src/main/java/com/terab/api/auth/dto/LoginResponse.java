package com.terab.api.auth.dto;

public record LoginResponse(String accessToken, UserResponse user) {}

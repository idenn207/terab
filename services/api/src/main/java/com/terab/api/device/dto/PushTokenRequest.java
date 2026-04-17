package com.terab.api.device.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PushTokenRequest(
  @NotBlank
  String pushToken,

  @NotBlank @Pattern(regexp = "android|ios", message = "platform은 android 또는 ios여야 합니다")
  String platform,

  String name
) {}

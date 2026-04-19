package com.terab.api.twofa.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RespondRequest(
  @NotBlank @Pattern(regexp = "\\d{2}") String selectedNumber
) {}

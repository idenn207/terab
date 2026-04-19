package com.terab.api.twofa.dto;

import java.util.List;
import com.terab.api.auth.dto.UserResponse;

public record ChallengeStatusResponse(
  String status,
  List<String> options,
  Integer remainingSeconds,
  String accessToken,
  UserResponse user
) {
  public static ChallengeStatusResponse pending(List<String> options, int remainingSeconds) {
    return new ChallengeStatusResponse("PENDING", options, remainingSeconds, null, null);
  }

  public static ChallengeStatusResponse approved(String accessToken, UserResponse user) {
    return new ChallengeStatusResponse("APPROVED", null, null, accessToken, user);
  }

  public static ChallengeStatusResponse denied() {
    return new ChallengeStatusResponse("DENIED", null, null, null, null);
  }
}

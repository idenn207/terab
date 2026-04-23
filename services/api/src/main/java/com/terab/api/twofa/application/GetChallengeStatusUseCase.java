package com.terab.api.twofa.application;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.twofa.application.interfaces.IGetChallengeStatusUseCase;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.dto.ChallengeStatusResponse;
import com.terab.api.twofa.service.TwoFaChallengeService;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GetChallengeStatusUseCase implements IGetChallengeStatusUseCase {

  private final TwoFaChallengeService twoFaChallengeService;
  private final AuthService authService;

  @Transactional
  @Override
  public ChallengeStatusResponse execute(UUID challengeId) {
    TwoFaChallenge challenge = twoFaChallengeService.findById(challengeId);

    if(challenge.isPending() && challenge.isExpired()) {
      twoFaChallengeService.markExpired(challenge);
      return ChallengeStatusResponse.denied();
    }

    return switch (challenge.getStatus()) {
      case "PENDING" -> {
        long seconds = Duration.between(OffsetDateTime.now(), challenge.getExpiresAt()).toSeconds();
        yield ChallengeStatusResponse.pending(challenge.getOptionsList(), challenge.getCorrectNum(), (int) Math.max(0, seconds));
      }
      case "APPROVED" -> {
        // LAZY 로드 - @Transactional 내에서 안전
        User user = challenge.getUser();
        String at = authService.generateAccessToken(user);
        yield ChallengeStatusResponse.approved(at, new UserResponse(user.getId(), user.getUsername(), user.getNickname()));
      }
      default -> ChallengeStatusResponse.denied();
    };
  }
}

package com.terab.api.twofa.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.twofa.application.interfaces.IRespondToChallengeUseCase;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.dto.RespondRequest;
import com.terab.api.twofa.service.TwoFaChallengeService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RespondToChallengeUseCase implements IRespondToChallengeUseCase {

  private final TwoFaChallengeService twoFaChallengeService;

  @Transactional
  @Override
  public void execute(UUID challengeId, RespondRequest request, UUID respondingUserId) {
    TwoFaChallenge challenge = twoFaChallengeService.findById(challengeId);

    if(!challenge.getUser().getId().equals(respondingUserId)) {
      throw new ApiException(ErrorCode.FORBIDDEN);
    }

    // 이미 처리되었거나 만료 - 204 반환 (브루트포스 방지: 맞음/틀림 미노출)
    if(!challenge.isPending() || challenge.isExpired()) {
      return;
    }

    if(challenge.getCorrectNum().equals(request.selectedNumber())) {
      twoFaChallengeService.approve(challenge);
    } else {
      twoFaChallengeService.deny(challenge);
    }
  }
}

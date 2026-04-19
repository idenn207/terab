package com.terab.api.twofa.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.twofa.application.interfaces.ICreateChallengeUseCase;
import com.terab.api.twofa.application.interfaces.IResendChallengeUseCase;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.dto.CreateChallengeResponse;
import com.terab.api.twofa.service.TwoFaChallengeService;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class ResendChallengeUseCase implements IResendChallengeUseCase {

  private final TwoFaChallengeService twoFaChallengeService;
  private final ICreateChallengeUseCase createChallengeUseCase;

  @Transactional
  @Override
  public CreateChallengeResponse execute(UUID oldChallengeId) {
    TwoFaChallenge old = twoFaChallengeService.findById(oldChallengeId);
    if(old.isPending()) {
      twoFaChallengeService.markExpired(old);
    }
    User user = old.getUser();
    return createChallengeUseCase.execute(user);
  }
}

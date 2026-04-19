package com.terab.api.twofa.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.device.service.DeviceService;
import com.terab.api.notification.event.PushChallengeEvent;
import com.terab.api.notification.publisher.PushChallengePublisher;
import com.terab.api.twofa.application.interfaces.ICreateChallengeUseCase;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.dto.CreateChallengeResponse;
import com.terab.api.twofa.service.TwoFaChallengeService;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class CreateChallengeUseCase implements ICreateChallengeUseCase {

  private final TwoFaChallengeService twoFaChallengeService;
  private final DeviceService deviceService;
  private final PushChallengePublisher pushChallengePublisher;

  @Transactional
  @Override
  public CreateChallengeResponse execute(User user) {
    TwoFaChallenge challenge = twoFaChallengeService.create(user);

    deviceService.findByUserId(user.getId()).stream()
      .filter(d -> d.getPushToken() != null)
      .forEach(d -> pushChallengePublisher.publish(new PushChallengeEvent(
        user.getId(),
        d.getPushToken(),
        challenge.getOptions(),
        challenge.getId(),
        challenge.getExpiresAt()
      )));

    return new CreateChallengeResponse(challenge.getId(), challenge.getOptionsList(), challenge.getExpiresAt());
  }
}

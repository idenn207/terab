package com.terab.notification.push.consumer;

import java.util.function.Consumer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;
import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class PushEventConsumer {
  private final FcmPushService fcmPushService;

  @Bean
  public Consumer<PushChallengeEvent> processPushChallenge() {
    return fcmPushService::sendPushChallenge;
  }
}

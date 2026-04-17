package com.terab.notification.unit.push;

import static org.mockito.Mockito.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.notification.push.consumer.PushEventConsumer;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;

@ExtendWith(MockitoExtension.class)
class PushEventConsumerTest {
  
  @Mock
  FcmPushService fcmPushService;

  @InjectMocks
  PushEventConsumer pushEventConsumer;

  @Test
  @DisplayName("processPushChallenge Consumer는 FcmPushService.sendPushChallenge를 위임 호출한다")
  void should_delegate_to_fcmPushService() {
    PushChallengeEvent event = new PushChallengeEvent(
      UUID.randomUUID(),
      "token",
      "47",
      UUID.randomUUID(),
      OffsetDateTime.now().plusMinutes(5)
    );

    pushEventConsumer.processPushChallenge().accept(event);

    verify(fcmPushService).sendPushChallenge(event);
  }
}

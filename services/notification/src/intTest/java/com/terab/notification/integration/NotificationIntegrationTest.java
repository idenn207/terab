package com.terab.notification.integration;

import static org.awaitility.Awaitility.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.google.firebase.messaging.FirebaseMessaging;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;
import com.terab.notification.support.NotificationIntegrationTestBase;

class NotificationIntegrationTest extends NotificationIntegrationTestBase {
  
  @Autowired
  RabbitTemplate rabbitTemplate;

  @MockitoBean
  FcmPushService fcmPushService;

  // FirebaseMessaging Bean을 Mock으로 교체 (FirebaseConfig 초기화 우회)
  @MockitoBean
  FirebaseMessaging firebaseMessaging;

  @Test
  @DisplayName("RabbitMQ에 PushChallengeEvent 발행 시 FcmPushService.sendPushChellenge가 호출된다")
  void should_consume_event_and_call_fcm_service() {
    PushChallengeEvent event = new PushChallengeEvent(
      UUID.randomUUID(),
      "fcm-token-integration",
      "83",
      UUID.randomUUID(),
      OffsetDateTime.now().plusMinutes(5)
    );

    // Topic Exchange에 직접 발행 (소비자 바인딩이 exchange를 먼저 생성하므로 타입 충돌 없음)
    rabbitTemplate.convertAndSend("terab.events", "auth.2fa.challenge", event);

    await()
      .atMost(Duration.ofSeconds(10))
      .untilAsserted(() -> verify(fcmPushService).sendPushChallenge(any()));
  }
}

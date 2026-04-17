package com.terab.api.integration;

import static org.assertj.core.api.Assertions.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.terab.api.notification.event.PushChallengeEvent;
import com.terab.api.notification.publisher.PushChallengePublisher;
import com.terab.api.support.IntegrationTestBase;

class PushChallengePublisherIntegrationTest extends IntegrationTestBase {
  
  @Autowired
  PushChallengePublisher pushChallengePublisher;

  @Test
  @DisplayName("PushChallengePublisher가 예외 없이 이벤트를 RabbitMQ에 발행한다")
  void should_publish_event_with_exception() {
    PushChallengeEvent event = new PushChallengeEvent(
      UUID.randomUUID(),
      "fcm-token-integration-test",
      "47",
      UUID.randomUUID(),
      OffsetDateTime.now().plusMinutes(5)
    );

    assertThatCode(() -> pushChallengePublisher.publish(event))
      .doesNotThrowAnyException();
  }
}

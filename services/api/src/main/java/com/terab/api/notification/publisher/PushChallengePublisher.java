package com.terab.api.notification.publisher;

import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import com.terab.api.notification.event.PushChallengeEvent;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class PushChallengePublisher {

  private static final String BINDING = "terab-events-out-0";
  private static final String ROUTING_KEY = "auth.2fa.challenge";

  private final StreamBridge streamBridge;

  public void publish(PushChallengeEvent event) {
    streamBridge.send(
      BINDING,
      MessageBuilder.withPayload(event)
        .setHeader("routingKey", ROUTING_KEY)
        .build()
    );
  }
}

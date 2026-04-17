package com.terab.notification.unit.push;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;

@ExtendWith(MockitoExtension.class)
class FcmPushServiceTest {
  
  @Mock
  FirebaseMessaging firebaseMessaging;

  @InjectMocks
  FcmPushService fcmPushService;

  private PushChallengeEvent sampleEvent() {
    return new PushChallengeEvent(
      UUID.randomUUID(),
      "fcm-token-test",
      "47",
      UUID.randomUUID(),
      OffsetDateTime.now().plusMinutes(5)
    );
  }

  @Test
  @DisplayName("정상 이벤트로 sendPushChallenge 호출 시 FirebaseMessaging.send()가 호출된다")
  void should_call_firebase_send_on_valid_event() throws FirebaseMessagingException {
    given(firebaseMessaging.send(any(Message.class))).willReturn("projects/test/messages/123");

    fcmPushService.sendPushChallenge(sampleEvent());

    verify(firebaseMessaging).send(any(Message.class));
  }

  @Test
  @DisplayName("FCM 전송 실패 시 RuntimeException을 던진다")
  void should_throw_runtime_exception_on_fcm_failure() throws FirebaseMessagingException {
    FirebaseMessagingException fcmEx = mock(FirebaseMessagingException.class);
    given(firebaseMessaging.send(any(Message.class))).willThrow(fcmEx);

    assertThatThrownBy(() -> fcmPushService.sendPushChallenge(sampleEvent()))
      .isInstanceOf(RuntimeException.class)
      .hasMessageContaining("FCM 전송 실패");
  }
}

package com.terab.notification.push.service;

import org.springframework.stereotype.Service;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.terab.notification.push.dto.PushChallengeEvent;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FcmPushService {

  private final FirebaseMessaging firebaseMessaging;

  public void sendPushChallenge(PushChallengeEvent event) {
    Notification notification = Notification.builder()
      .setTitle("로그인 승인 요청")
      .setBody(String.format("숫자 %s를 확인하고 승인해 주세요.", event.code()))
      .build();

    Message message = Message.builder()
      .setToken(event.pushToken())
      .setNotification(notification)
      .putData("type", "2FA_CHALLENGE")
      .putData("challengeId", event.challengeId().toString())
      .putData("code", event.code())
      .putData("expiresAt", event.expiresAt().toString())
      .build();

    try {
      firebaseMessaging.send(message);
    } catch (FirebaseMessagingException e) {
      throw new RuntimeException("FCM 전송 실패: " + e.getMessage(), e);
    }
  }
}

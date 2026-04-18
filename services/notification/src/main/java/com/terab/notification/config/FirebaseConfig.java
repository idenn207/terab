package com.terab.notification.config;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

@Configuration
public class FirebaseConfig {

  @Value("${firebase.credentials-path}")
  private String credentialsPath;

  @Bean
  public FirebaseMessaging firebaseMessaging() throws IOException {
    FirebaseApp app;
    if(FirebaseApp.getApps().isEmpty()) {
      FirebaseOptions options = FirebaseOptions.builder()
        .setCredentials(GoogleCredentials.fromStream(new FileInputStream(resolveCredentialsPath(credentialsPath).toString())))
        .build();
      app = FirebaseApp.initializeApp(options);
    } else {
      app = FirebaseApp.getInstance();
    }
    return FirebaseMessaging.getInstance(app);
  }

  private Path resolveCredentialsPath(String rawPath) {
    if (rawPath.startsWith("~")) {
      return Path.of(System.getProperty("user.home"), rawPath.substring(1));
    }
    if (Path.of(rawPath).isAbsolute()) {
      return Path.of(rawPath);
    }
    // 상대 경로 → 실행 디렉터리(user.dir) 기준
    // Docker: user.dir=/app, 절대 경로를 사용하므로 이 분기에 들어오지 않음
    // 로컬 Gradle: user.dir=services/notification
    return Path.of(System.getProperty("user.dir")).resolve(rawPath);
  }
}

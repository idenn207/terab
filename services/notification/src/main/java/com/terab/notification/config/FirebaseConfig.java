package com.terab.notification.config;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
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
    // ./나 상대 경로 → 프로젝트 루트 기준
    return findProjectRoot().resolve(rawPath);
  }

  // Makefile 존재 여부로 프로젝트 루트 탐색
  private Path findProjectRoot() {
    Path dir = Path.of(System.getProperty("user.dir"));
    while (dir != null) {
      if (Files.exists(dir.resolve("Makefile"))) {
        return dir;
      }
      dir = dir.getParent();
    }
    return Path.of(System.getProperty("user.dir"));
  }
}

package com.terab.notification.config;

import java.io.FileInputStream;
import java.io.IOException;
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
        .setCredentials(GoogleCredentials.fromStream(new FileInputStream(credentialsPath)))
        .build();
      app = FirebaseApp.initializeApp(options);
    } else {
      app = FirebaseApp.getInstance();
    }
    return FirebaseMessaging.getInstance(app);
  }
}

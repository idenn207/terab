package com.terab.notification.support;

import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@ActiveProfiles("integration")
@Import(NotificationIntegrationTestBase.TestAmqpConfig.class)
public abstract class NotificationIntegrationTestBase {

  @TestConfiguration
  static class TestAmqpConfig {
    @Bean
    JacksonJsonMessageConverter messageConverter() {
      return new JacksonJsonMessageConverter();
    }
  }

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.rabbitmq.host", TestContainersConfig.RABBITMQ::getHost);
    registry.add("spring.rabbitmq.port", TestContainersConfig.RABBITMQ::getAmqpPort);
    registry.add("spring.rabbitmq.username", () -> "terab");
    registry.add("spring.rabbitmq.password", () -> "terab");
  }
}

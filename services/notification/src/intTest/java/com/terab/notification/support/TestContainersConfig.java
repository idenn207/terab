package com.terab.notification.support;

import org.testcontainers.rabbitmq.RabbitMQContainer;
import org.testcontainers.utility.DockerImageName;

public final class TestContainersConfig {

  @SuppressWarnings("resource")
  public static final RabbitMQContainer RABBITMQ =
    new RabbitMQContainer(DockerImageName.parse("rabbitmq:3.13-alpine"))
      .withAdminUser("terab")
      .withAdminPassword("terab");

  static {
    RABBITMQ.start();
  }

  private TestContainersConfig() {}
}

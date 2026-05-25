# Notification MS (DEV-007, DEV-008) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push 2FA에 필요한 Notification MS(Spring Boot + RabbitMQ + Firebase FCM)와 Push Token 등록 API를 구축한다.

**Architecture:** API 서비스가 Spring Cloud Stream StreamBridge로 `terab.events` Topic Exchange에 이벤트를 발행하면, 별도 Notification MS가 해당 큐를 소비하여 Firebase Admin SDK로 FCM Push를 전송한다. Spring Cloud Stream binder 추상화로 향후 RabbitMQ → Redis Streams 교체 시 비즈니스 로직 변경 없이 `build.gradle` + `application.yml`만 바꾼다.

**Tech Stack:** Spring Boot 3.5.13 / Java 21 / Spring Cloud Stream 4.x (RabbitMQ binder) / Firebase Admin SDK 9.4.1 / Testcontainers RabbitMQ / Lombok

---

## 파일 맵

### 인프라 — 수정

```
docker-compose.local.yml          (rabbitmq 서비스 추가)
local.env                         (RabbitMQ 변수 추가)
Makefile                          (infra 커맨드 rabbitmq 포함, notification 개발 서버 추가)
```

### API 서비스 — 신규 생성

```
services/api/src/main/resources/db/migration/V3__devices.sql
services/api/src/main/java/com/terab/api/device/domain/Device.java
services/api/src/main/java/com/terab/api/device/repository/DeviceRepository.java
services/api/src/main/java/com/terab/api/device/dto/PushTokenRequest.java
services/api/src/main/java/com/terab/api/device/dto/PushTokenResponse.java
services/api/src/main/java/com/terab/api/device/service/DeviceService.java
services/api/src/main/java/com/terab/api/device/controller/DeviceController.java
services/api/src/main/java/com/terab/api/notification/event/PushChallengeEvent.java
services/api/src/main/java/com/terab/api/notification/publisher/PushChallengePublisher.java
services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java
services/api/src/intTest/java/com/terab/api/integration/PushChallengePublisherIntegrationTest.java
```

### API 서비스 — 수정

```
services/api/build.gradle                                        (spring-cloud-stream + rabbit binder 추가)
services/api/src/main/resources/application.yml                  (RabbitMQ + Stream binding 설정)
services/api/src/main/resources/application-local.yml            (로컬 RabbitMQ 접속 정보)
services/api/src/intTest/java/com/terab/api/support/TestContainersConfig.java  (RabbitMQ 컨테이너 추가)
services/api/src/intTest/java/com/terab/api/support/IntegrationTestBase.java   (RabbitMQ 프로퍼티 주입)
services/api/src/intTest/resources/application-integration.yml   (RabbitMQ 플레이스홀더 추가)
```

### Notification MS — 신규 생성 (전체)

```
services/notification/build.gradle
services/notification/settings.gradle
services/notification/Dockerfile
services/notification/src/main/java/com/terab/notification/NotificationApplication.java
services/notification/src/main/java/com/terab/notification/config/FirebaseConfig.java
services/notification/src/main/java/com/terab/notification/push/dto/PushChallengeEvent.java
services/notification/src/main/java/com/terab/notification/push/service/FcmPushService.java
services/notification/src/main/java/com/terab/notification/push/consumer/PushEventConsumer.java
services/notification/src/main/resources/application.yml
services/notification/src/main/resources/application-local.yml
services/notification/src/test/java/com/terab/notification/push/service/FcmPushServiceTest.java
services/notification/src/test/java/com/terab/notification/push/consumer/PushEventConsumerTest.java
services/notification/src/intTest/java/com/terab/notification/integration/NotificationIntegrationTest.java
services/notification/src/intTest/java/com/terab/notification/support/NotificationIntegrationTestBase.java
services/notification/src/intTest/java/com/terab/notification/support/TestContainersConfig.java
services/notification/src/intTest/resources/application-integration.yml
```

---

## Task 1: 인프라 — local.env + docker-compose.local.yml RabbitMQ 추가

**Files:**
- Modify: `local.env`
- Modify: `docker-compose.local.yml`

- [ ] **Step 1: local.env에 RabbitMQ 변수 추가**

`local.env`의 Spring Boot 키 섹션(소문자)에 아래 줄을 추가한다:

```
rabbitmq_host=localhost
rabbitmq_port=5672
rabbitmq_username=terab
terab_rabbitmq_password=terab1234
```

`local.env`의 Docker Compose 키 섹션(대문자)에 아래 줄을 추가한다:

```
RABBITMQ_PASSWORD=terab1234
```

- [ ] **Step 2: docker-compose.local.yml에 rabbitmq 서비스 추가**

`docker-compose.local.yml`의 `services:` 블록 안에 (db 서비스 아래) 아래를 추가한다:

```yaml
  # ─── RabbitMQ (메시지 브로커) ─────────────────────────────────
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: terab-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: terab
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - ./volumes/rabbitmq:/var/lib/rabbitmq
    ports:
      - '5672:5672'
      - '15672:15672'
    networks:
      - terab-net
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

- [ ] **Step 3: Makefile의 infra 커맨드에 rabbitmq 추가**

`Makefile`에서 `infra` 타겟을 찾아 rabbitmq를 포함하도록 수정한다:

```makefile
.PHONY: infra
infra:
	$(LOCAL) up -d db minio rabbitmq
```

`infra-down` 타겟도 동일하게 수정한다:

```makefile
.PHONY: infra-down
infra-down:
	$(LOCAL) stop db minio rabbitmq
```

- [ ] **Step 4: Makefile에 notification 개발 서버 커맨드 추가**

`api` 타겟 아래에 추가:

```makefile
.PHONY: notification
notification:
	cd services/notification && ./gradlew bootRun --args='--spring.profiles.active=local'

.PHONY: test-notification
test-notification:
	cd services/notification && ./gradlew check
```

- [ ] **Step 5: Commit**

```bash
git add local.env docker-compose.local.yml Makefile
git commit -m "chore: RabbitMQ 로컬 인프라 및 Makefile 커맨드 추가"
```

---

## Task 2: API build.gradle — Spring Cloud Stream 의존성 추가

**Files:**
- Modify: `services/api/build.gradle`

- [ ] **Step 1: build.gradle에 Spring Cloud BOM + Stream 의존성 추가**

`plugins` 블록 아래, `repositories` 위에 다음을 추가한다:

```groovy
ext {
    set('springCloudVersion', '2024.0.1')
}
```

`dependencies` 블록에 다음을 추가한다 (기존 의존성 유지):

```groovy
    // Spring Cloud Stream (RabbitMQ binder)
    implementation 'org.springframework.cloud:spring-cloud-stream'
    implementation 'org.springframework.cloud:spring-cloud-starter-stream-rabbit'

    // Testcontainers — RabbitMQ (통합 테스트)
    testImplementation 'org.testcontainers:rabbitmq'
```

`dependencyManagement` 블록을 파일 하단 (테스트 태스크 설정 위)에 추가한다:

```groovy
dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:${springCloudVersion}"
    }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api && ./gradlew dependencies --configuration compileClasspath | grep spring-cloud-stream
```

Expected: `spring-cloud-stream` 및 `spring-cloud-starter-stream-rabbit` 가 출력됨.

- [ ] **Step 3: Commit**

```bash
git add services/api/build.gradle
git commit -m "chore: API 서비스에 Spring Cloud Stream RabbitMQ binder 의존성 추가"
```

---

## Task 3: API application.yml — RabbitMQ + Stream 설정 추가

**Files:**
- Modify: `services/api/src/main/resources/application.yml`
- Modify: `services/api/src/main/resources/application-local.yml` (없으면 신규 생성)

- [ ] **Step 1: application.yml에 RabbitMQ + Stream 설정 추가**

`application.yml`의 `spring:` 블록 안 (flyway 블록 아래)에 추가:

```yaml
  rabbitmq:
    host: ${rabbitmq_host:localhost}
    port: ${rabbitmq_port:5672}
    username: ${rabbitmq_username:terab}
    password: ${terab_rabbitmq_password:}
  cloud:
    stream:
      bindings:
        terab-events-out-0:
          destination: terab.events
          content-type: application/json
      rabbit:
        bindings:
          terab-events-out-0:
            producer:
              routing-key-expression: headers['routingKey']
              exchange-type: topic
```

- [ ] **Step 2: application-local.yml 확인 또는 생성**

`services/api/src/main/resources/application-local.yml`이 있으면 RabbitMQ 설정이 있는지 확인한다. 없거나 RabbitMQ 항목이 없으면 아래 내용을 추가한다:

파일이 없으면 새로 생성:

```yaml
# 로컬 개발 전용 설정 — Spring profile: local
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: terab
    password: terab1234
```

파일이 이미 있으면 `spring.rabbitmq` 섹션만 추가한다.

- [ ] **Step 3: application.properties의 make setup-local 확인**

`local.env`의 소문자 키(`rabbitmq_host`, `rabbitmq_port`, `rabbitmq_username`, `terab_rabbitmq_password`)가 `make setup-local` 시 `services/api/application-local.properties`에 포함되는지 확인한다:

```bash
make setup-local && grep rabbitmq services/api/application-local.properties
```

Expected: `rabbitmq_host=localhost` 등 4줄 출력.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/main/resources/application.yml services/api/src/main/resources/application-local.yml
git commit -m "chore: API 서비스 application.yml에 RabbitMQ + Stream binding 설정 추가"
```

---

## Task 4: V3 DB Migration — devices 테이블

**Files:**
- Create: `services/api/src/main/resources/db/migration/V3__devices.sql`

- [ ] **Step 1: V3__devices.sql 생성**

```sql
-- V3__devices.sql
-- Push Token 등록을 위한 devices 테이블
-- Device 관리 UI (D-10a)는 Phase 3에서 구현

CREATE TABLE devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200),
  push_token   VARCHAR(500),
  platform     VARCHAR(10) NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_push_token ON devices(push_token);
```

- [ ] **Step 2: 마이그레이션 적용 확인**

```bash
make infra  # DB 실행 중인지 확인
cd services/api && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 15 && curl -s http://localhost:8080/actuator/health | grep '"status":"UP"'
kill %1
```

Expected: `"status":"UP"` 출력.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/resources/db/migration/V3__devices.sql
git commit -m "feat: V3 마이그레이션 — devices 테이블 추가 (Push Token 저장)"
```

---

## Task 5: Device 도메인 엔티티 + Repository

**Files:**
- Create: `services/api/src/main/java/com/terab/api/device/domain/Device.java`
- Create: `services/api/src/main/java/com/terab/api/device/repository/DeviceRepository.java`

- [ ] **Step 1: Device.java 생성**

```java
package com.terab.api.device.domain;

import java.time.OffsetDateTime;
import java.util.UUID;
import com.terab.api.user.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "devices")
@Getter
@Setter
@NoArgsConstructor
public class Device {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(length = 200)
  private String name;

  @Column(length = 500)
  private String pushToken;

  @Column(nullable = false, length = 10)
  private String platform;

  private OffsetDateTime lastSeenAt;

  @Column(nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @PrePersist
  void prePersist() {
    this.createdAt = OffsetDateTime.now();
  }
}
```

- [ ] **Step 2: DeviceRepository.java 생성**

```java
package com.terab.api.device.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.terab.api.device.domain.Device;

public interface DeviceRepository extends JpaRepository<Device, UUID> {

  Optional<Device> findByPushToken(String pushToken);

  List<Device> findByUserId(UUID userId);
}
```

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/java/com/terab/api/device/
git commit -m "feat: Device JPA 엔티티 및 Repository 추가"
```

---

## Task 6: DeviceController 슬라이스 테스트 (TDD — RED)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/device/dto/PushTokenRequest.java`
- Create: `services/api/src/main/java/com/terab/api/device/dto/PushTokenResponse.java`
- Create: `services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java`

- [ ] **Step 1: PushTokenRequest.java 생성**

```java
package com.terab.api.device.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PushTokenRequest(
    @NotBlank String pushToken,
    @NotBlank @Pattern(regexp = "android|ios", message = "platform은 android 또는 ios여야 합니다") String platform,
    String name
) {}
```

- [ ] **Step 2: PushTokenResponse.java 생성**

```java
package com.terab.api.device.dto;

import java.util.UUID;

public record PushTokenResponse(UUID deviceId) {}
```

- [ ] **Step 3: DeviceControllerTest.java 작성**

```java
package com.terab.api.slice;

import static com.terab.api.support.SecurityTestSupport.authenticatedUser;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.device.controller.DeviceController;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.device.service.DeviceService;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(DeviceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class DeviceControllerTest {

  @Autowired
  MockMvc mockMvc;

  @MockitoBean
  DeviceService deviceService;

  @MockitoBean
  JwtProvider jwtProvider;

  @Nested
  @DisplayName("POST /api/auth/devices/push-token")
  class RegisterPushToken {

    @Test
    @DisplayName("유효한 요청으로 Push Token 등록 시 200과 deviceId를 반환한다")
    void should_return_200_with_deviceId() throws Exception {
      UUID userId = UUID.randomUUID();
      UUID deviceId = UUID.randomUUID();

      given(deviceService.registerPushToken(eq(userId), any())).willReturn(new PushTokenResponse(deviceId));

      mockMvc.perform(
          post("/api/auth/devices/push-token")
              .with(authenticatedUser(userId))
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {
                    "pushToken": "fcm-token-abc123",
                    "platform": "android",
                    "name": "Galaxy S24"
                  }
                  """))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.deviceId").value(deviceId.toString()));
    }

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(
          post("/api/auth/devices/push-token")
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"pushToken": "token", "platform": "android"}
                  """))
          .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("platform이 invalid하면 400을 반환한다")
    void should_return_400_with_invalid_platform() throws Exception {
      UUID userId = UUID.randomUUID();

      mockMvc.perform(
          post("/api/auth/devices/push-token")
              .with(authenticatedUser(userId))
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"pushToken": "token", "platform": "windows"}
                  """))
          .andExpect(status().isBadRequest());
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.DeviceControllerTest" -i 2>&1 | tail -20
```

Expected: `DeviceService` · `DeviceController` 클래스가 없어서 컴파일 에러 발생.

---

## Task 7: DeviceService + DeviceController 구현 (TDD — GREEN)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/device/service/DeviceService.java`
- Create: `services/api/src/main/java/com/terab/api/device/controller/DeviceController.java`

- [ ] **Step 1: DeviceService.java 생성**

```java
package com.terab.api.device.service;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.device.domain.Device;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.device.repository.DeviceRepository;
import com.terab.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class DeviceService {

  private final DeviceRepository deviceRepository;
  private final UserRepository userRepository;

  public PushTokenResponse registerPushToken(UUID userId, PushTokenRequest request) {
    var user = userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));

    Device device = deviceRepository.findByPushToken(request.pushToken())
        .orElse(new Device());

    device.setUser(user);
    device.setPushToken(request.pushToken());
    device.setPlatform(request.platform());
    device.setLastSeenAt(OffsetDateTime.now());
    if (request.name() != null) {
      device.setName(request.name());
    }

    device = deviceRepository.save(device);
    return new PushTokenResponse(device.getId());
  }
}
```

- [ ] **Step 2: DeviceController.java 생성**

```java
package com.terab.api.device.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.device.service.DeviceService;
import com.terab.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth/devices")
@RequiredArgsConstructor
public class DeviceController {

  private final DeviceService deviceService;

  @PostMapping("/push-token")
  public ResponseEntity<PushTokenResponse> registerPushToken(
      @RequestBody @Valid PushTokenRequest request,
      @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(deviceService.registerPushToken(userDetails.getUserId(), request));
  }
}
```

- [ ] **Step 3: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.DeviceControllerTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 3개 테스트 PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/main/java/com/terab/api/device/ \
        services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java
git commit -m "feat: Push Token 등록 API 추가 (POST /api/auth/devices/push-token)"
```

---

## Task 8: PushChallengeEvent + PushChallengePublisher (API 서비스)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/notification/event/PushChallengeEvent.java`
- Create: `services/api/src/main/java/com/terab/api/notification/publisher/PushChallengePublisher.java`

- [ ] **Step 1: PushChallengeEvent.java 생성**

```java
package com.terab.api.notification.event;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PushChallengeEvent(
    UUID userId,
    String pushToken,
    String code,
    UUID challengeId,
    OffsetDateTime expiresAt
) {}
```

- [ ] **Step 2: PushChallengePublisher.java 생성**

```java
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
    streamBridge.send(BINDING,
        MessageBuilder.withPayload(event)
            .setHeader("routingKey", ROUTING_KEY)
            .build());
  }
}
```

> **참고:** `PushChallengePublisher`는 Phase 3 (Push 2FA, DEV-012) 에서 `AuthService.createChallenge()`에 주입되어 호출된다. 이 태스크에서는 인프라 준비만 한다.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/java/com/terab/api/notification/
git commit -m "feat: PushChallengeEvent + PushChallengePublisher 추가 (Phase 3 연결 대기)"
```

---

## Task 9: API 서비스 통합 테스트 — TestContainersConfig RabbitMQ 추가 + Publisher 통합 테스트

**Files:**
- Modify: `services/api/src/intTest/java/com/terab/api/support/TestContainersConfig.java`
- Modify: `services/api/src/intTest/java/com/terab/api/support/IntegrationTestBase.java`
- Modify: `services/api/src/intTest/resources/application-integration.yml`
- Create: `services/api/src/intTest/java/com/terab/api/integration/PushChallengePublisherIntegrationTest.java`

- [ ] **Step 1: TestContainersConfig에 RabbitMQ 추가**

기존 파일의 `MINIO` 컨테이너 아래에 추가:

```java
  @SuppressWarnings("resource")
  public static final RabbitMQContainer RABBITMQ =
      new RabbitMQContainer(DockerImageName.parse("rabbitmq:3.13-alpine"))
          .withUser("terab", "terab");

  static {
    POSTGRES.start();
    MINIO.start();
    RABBITMQ.start();
  }
```

파일 상단 import에 추가:
```java
import org.testcontainers.containers.RabbitMQContainer;
```

- [ ] **Step 2: IntegrationTestBase에 RabbitMQ 프로퍼티 주입 추가**

`@DynamicPropertySource` 메서드 안에 다음을 추가:

```java
        // RabbitMQ
        registry.add("spring.rabbitmq.host", TestContainersConfig.RABBITMQ::getHost);
        registry.add("spring.rabbitmq.port", TestContainersConfig.RABBITMQ::getAmqpPort);
        registry.add("spring.rabbitmq.username", () -> "terab");
        registry.add("spring.rabbitmq.password", () -> "terab");
```

- [ ] **Step 3: application-integration.yml에 RabbitMQ 플레이스홀더 추가**

기존 파일 하단에 추가 (Testcontainers가 @DynamicPropertySource로 덮어씀):

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: terab
    password: terab
  cloud:
    stream:
      bindings:
        terab-events-out-0:
          destination: terab.events
```

- [ ] **Step 4: PushChallengePublisherIntegrationTest.java 작성 (TDD — RED)**

```java
package com.terab.api.integration;

import static org.assertj.core.api.Assertions.assertThatCode;
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
  void should_publish_event_without_exception() {
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
```

- [ ] **Step 5: 통합 테스트 실행 — PASS 확인**

```bash
cd services/api && ./gradlew integrationTest --tests "com.terab.api.integration.PushChallengePublisherIntegrationTest" -i 2>&1 | tail -15
```

Expected: `BUILD SUCCESSFUL`, 1개 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/intTest/ \
        services/api/src/intTest/resources/application-integration.yml
git commit -m "test: PushChallengePublisher RabbitMQ 통합 테스트 추가"
```

---

## Task 10: Notification MS 프로젝트 스캐폴드

**Files:**
- Create: `services/notification/settings.gradle`
- Create: `services/notification/build.gradle`
- Create: `services/notification/src/main/java/com/terab/notification/NotificationApplication.java`
- Create: `services/notification/src/main/resources/application.yml`
- Create: `services/notification/src/main/resources/application-local.yml`

- [ ] **Step 1: settings.gradle 생성**

```groovy
rootProject.name = 'terab-notification'
```

- [ ] **Step 2: build.gradle 생성**

```groovy
plugins {
    id 'org.springframework.boot' version '3.5.13'
    id 'io.spring.dependency-management' version '1.1.7'
    id 'java'
}

group = 'com.terab'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

ext['lombok.version'] = '1.18.40'

ext {
    set('springCloudVersion', '2024.0.1')
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'

    // Spring Cloud Stream (RabbitMQ binder)
    implementation 'org.springframework.cloud:spring-cloud-stream'
    implementation 'org.springframework.cloud:spring-cloud-starter-stream-rabbit'

    // Firebase Admin SDK
    implementation 'com.google.firebase:firebase-admin:9.4.1'

    // Lombok
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    testCompileOnly 'org.projectlombok:lombok'
    testAnnotationProcessor 'org.projectlombok:lombok'

    // 테스트
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.cloud:spring-cloud-stream-test-binder'

    // Testcontainers (통합 테스트)
    testImplementation 'org.testcontainers:testcontainers'
    testImplementation 'org.testcontainers:junit-jupiter'
    testImplementation 'org.testcontainers:rabbitmq'

    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:${springCloudVersion}"
    }
}

// =============================================================================
// 테스트 소스셋 및 태스크 설정
// =============================================================================

sourceSets {
    intTest {
        java.srcDir 'src/intTest/java'
        resources.srcDir 'src/intTest/resources'
        compileClasspath += sourceSets.main.output + sourceSets.test.output
        runtimeClasspath += sourceSets.main.output + sourceSets.test.output
    }
}

configurations {
    intTestImplementation.extendsFrom testImplementation
    intTestRuntimeOnly.extendsFrom testRuntimeOnly
    intTestCompileOnly.extendsFrom testCompileOnly
    intTestAnnotationProcessor.extendsFrom testAnnotationProcessor
}

tasks.named('test') {
    useJUnitPlatform()
    exclude '**/_*Template*'
    onlyIf {
        !testClassesDirs.asFileTree.matching {
            include '**/*Test.class', '**/*Tests.class'
            exclude '**/_*Template*'
        }.empty
    }
}

tasks.register('integrationTest', Test) {
    description = 'Runs integration tests with Testcontainers.'
    group = 'verification'
    testClassesDirs = sourceSets.intTest.output.classesDirs
    classpath = sourceSets.intTest.runtimeClasspath
    useJUnitPlatform()
    exclude '**/_*Template*'
    onlyIf {
        !testClassesDirs.asFileTree.matching {
            include '**/*Test.class', '**/*Tests.class'
            exclude '**/_*Template*'
        }.empty
    }
}

tasks.named('processIntTestResources') {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

tasks.named('check') {
    dependsOn tasks.named('integrationTest')
}
```

- [ ] **Step 3: NotificationApplication.java 생성**

```java
package com.terab.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class NotificationApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotificationApplication.class, args);
    }
}
```

- [ ] **Step 4: application.yml 생성**

```yaml
spring:
  config:
    import:
      - 'optional:configtree:/run/secrets/'
      - 'optional:configtree:/run/configs/'
  rabbitmq:
    host: ${rabbitmq_host:localhost}
    port: ${rabbitmq_port:5672}
    username: ${rabbitmq_username:terab}
    password: ${terab_rabbitmq_password:}
  cloud:
    function:
      definition: processPushChallenge
    stream:
      bindings:
        processPushChallenge-in-0:
          destination: terab.events
          group: notification-push
          content-type: application/json
      rabbit:
        bindings:
          processPushChallenge-in-0:
            consumer:
              binding-routing-key: auth.2fa.challenge
              exchange-type: topic

server:
  port: 8082

firebase:
  credentials-path: ${FIREBASE_CREDENTIALS_PATH:}

management:
  endpoints:
    web:
      exposure:
        include: health
```

- [ ] **Step 5: application-local.yml 생성**

```yaml
# 로컬 개발 전용 설정 — Spring profile: local
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: terab
    password: terab1234

firebase:
  credentials-path: ${FIREBASE_CREDENTIALS_PATH:}
```

- [ ] **Step 6: Gradle Wrapper 복사**

API 서비스의 Gradle wrapper를 복사한다 (같은 Gradle 버전 사용):

```bash
cp -r services/api/gradle services/notification/gradle
cp services/api/gradlew services/notification/gradlew
cp services/api/gradlew.bat services/notification/gradlew.bat
```

- [ ] **Step 7: 빌드 확인**

```bash
cd services/notification && ./gradlew build -x test 2>&1 | tail -5
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 8: Commit**

```bash
git add services/notification/
git commit -m "feat: Notification MS 프로젝트 스캐폴드 (Spring Cloud Stream + Firebase)"
```

---

## Task 11: PushChallengeEvent DTO (Notification MS)

**Files:**
- Create: `services/notification/src/main/java/com/terab/notification/push/dto/PushChallengeEvent.java`

- [ ] **Step 1: PushChallengeEvent.java 생성**

> 마이크로서비스 간 DTO는 독립적으로 관리한다. API 서비스의 동명 클래스와 별도로 유지한다.

```java
package com.terab.notification.push.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PushChallengeEvent(
    UUID userId,
    String pushToken,
    String code,
    UUID challengeId,
    OffsetDateTime expiresAt
) {}
```

- [ ] **Step 2: Commit**

```bash
git add services/notification/src/main/java/com/terab/notification/push/dto/
git commit -m "feat: Notification MS PushChallengeEvent DTO 추가"
```

---

## Task 12: FcmPushService TDD

**Files:**
- Create: `services/notification/src/test/java/com/terab/notification/push/service/FcmPushServiceTest.java`
- Create: `services/notification/src/main/java/com/terab/notification/push/service/FcmPushService.java`

- [ ] **Step 1: FcmPushServiceTest.java 작성 (RED)**

```java
package com.terab.notification.push.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.terab.notification.push.dto.PushChallengeEvent;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/notification && ./gradlew test --tests "com.terab.notification.push.service.FcmPushServiceTest" -i 2>&1 | tail -10
```

Expected: `FcmPushService` 클래스가 없어서 컴파일 에러.

- [ ] **Step 3: FcmPushService.java 구현**

```java
package com.terab.notification.push.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.terab.notification.push.dto.PushChallengeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
```

- [ ] **Step 4: 테스트 재실행 — PASS 확인**

```bash
cd services/notification && ./gradlew test --tests "com.terab.notification.push.service.FcmPushServiceTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 2개 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/notification/src/main/java/com/terab/notification/push/service/ \
        services/notification/src/test/java/com/terab/notification/push/service/
git commit -m "feat: FcmPushService 구현 및 단위 테스트 추가"
```

---

## Task 13: PushEventConsumer TDD

**Files:**
- Create: `services/notification/src/test/java/com/terab/notification/push/consumer/PushEventConsumerTest.java`
- Create: `services/notification/src/main/java/com/terab/notification/push/consumer/PushEventConsumer.java`

- [ ] **Step 1: PushEventConsumerTest.java 작성 (RED)**

```java
package com.terab.notification.push.consumer;

import static org.mockito.Mockito.verify;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PushEventConsumerTest {

  @Mock
  FcmPushService fcmPushService;

  @InjectMocks
  PushEventConsumer pushEventConsumer;

  @Test
  @DisplayName("processPushChallenge Consumer는 FcmPushService.sendPushChallenge를 위임 호출한다")
  void should_delegate_to_fcmPushService() {
    PushChallengeEvent event = new PushChallengeEvent(
        UUID.randomUUID(), "token", "47", UUID.randomUUID(),
        OffsetDateTime.now().plusMinutes(5)
    );

    pushEventConsumer.processPushChallenge().accept(event);

    verify(fcmPushService).sendPushChallenge(event);
  }
}
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/notification && ./gradlew test --tests "com.terab.notification.push.consumer.PushEventConsumerTest" -i 2>&1 | tail -10
```

Expected: `PushEventConsumer` 클래스가 없어서 컴파일 에러.

- [ ] **Step 3: PushEventConsumer.java 구현**

```java
package com.terab.notification.push.consumer;

import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class PushEventConsumer {

  private final FcmPushService fcmPushService;

  @Bean
  public Consumer<PushChallengeEvent> processPushChallenge() {
    return fcmPushService::sendPushChallenge;
  }
}
```

- [ ] **Step 4: 테스트 재실행 — PASS 확인**

```bash
cd services/notification && ./gradlew test --tests "com.terab.notification.push.consumer.PushEventConsumerTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 1개 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/notification/src/main/java/com/terab/notification/push/consumer/ \
        services/notification/src/test/java/com/terab/notification/push/consumer/
git commit -m "feat: PushEventConsumer 구현 및 단위 테스트 추가"
```

---

## Task 14: FirebaseConfig

**Files:**
- Create: `services/notification/src/main/java/com/terab/notification/config/FirebaseConfig.java`

- [ ] **Step 1: FirebaseConfig.java 생성**

```java
package com.terab.notification.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.FileInputStream;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FirebaseConfig {

  @Value("${firebase.credentials-path}")
  private String credentialsPath;

  @Bean
  public FirebaseMessaging firebaseMessaging() throws IOException {
    FirebaseApp app;
    if (FirebaseApp.getApps().isEmpty()) {
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
```

> **테스트에서의 처리:** `@WebMvcTest`나 `@SpringBootTest`에서 `@MockitoBean FirebaseMessaging firebaseMessaging`을 선언하면 이 Bean을 Mock으로 대체한다. `application-integration.yml`에서 `firebase.credentials-path`를 비워두면 컨텍스트 로딩 시 에러가 발생하므로, 통합 테스트에서는 `@MockitoBean`으로 완전히 교체한다.

- [ ] **Step 2: Commit**

```bash
git add services/notification/src/main/java/com/terab/notification/config/
git commit -m "feat: FirebaseConfig 추가 (FirebaseMessaging Bean 초기화)"
```

---

## Task 15: Notification MS 통합 테스트 (Testcontainers RabbitMQ)

**Files:**
- Create: `services/notification/src/intTest/java/com/terab/notification/support/TestContainersConfig.java`
- Create: `services/notification/src/intTest/java/com/terab/notification/support/NotificationIntegrationTestBase.java`
- Create: `services/notification/src/intTest/resources/application-integration.yml`
- Create: `services/notification/src/intTest/java/com/terab/notification/integration/NotificationIntegrationTest.java`

- [ ] **Step 1: TestContainersConfig.java 생성**

```java
package com.terab.notification.support;

import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.utility.DockerImageName;

public final class TestContainersConfig {

  @SuppressWarnings("resource")
  public static final RabbitMQContainer RABBITMQ =
      new RabbitMQContainer(DockerImageName.parse("rabbitmq:3.13-alpine"))
          .withUser("terab", "terab");

  static {
    RABBITMQ.start();
  }

  private TestContainersConfig() {}
}
```

- [ ] **Step 2: NotificationIntegrationTestBase.java 생성**

```java
package com.terab.notification.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@ActiveProfiles("integration")
public abstract class NotificationIntegrationTestBase {

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.rabbitmq.host", TestContainersConfig.RABBITMQ::getHost);
    registry.add("spring.rabbitmq.port", TestContainersConfig.RABBITMQ::getAmqpPort);
    registry.add("spring.rabbitmq.username", () -> "terab");
    registry.add("spring.rabbitmq.password", () -> "terab");
  }
}
```

- [ ] **Step 3: application-integration.yml 생성**

```yaml
spring:
  cloud:
    function:
      definition: processPushChallenge
    stream:
      bindings:
        processPushChallenge-in-0:
          destination: terab.events
          group: notification-push-integration
      rabbit:
        bindings:
          processPushChallenge-in-0:
            consumer:
              binding-routing-key: auth.2fa.challenge
              exchange-type: topic
  rabbitmq:
    host: localhost
    port: 5672
    username: terab
    password: terab

firebase:
  credentials-path: dummy-path-overridden-by-mock
```

- [ ] **Step 4: build.gradle에 awaitility 의존성 추가**

`dependencies` 블록에 추가:

```groovy
    testImplementation 'org.awaitility:awaitility:4.2.2'
```

- [ ] **Step 5: NotificationIntegrationTest.java 작성 (TDD — RED)**

`AmqpTemplate`으로 직접 발행한다. `StreamBridge`는 출력 바인딩 설정이 없으면 교환기 타입이 Direct로 생성되어 Topic Exchange와 충돌할 수 있기 때문이다.

```java
package com.terab.notification.integration;

import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import com.google.firebase.messaging.FirebaseMessaging;
import com.terab.notification.push.dto.PushChallengeEvent;
import com.terab.notification.push.service.FcmPushService;
import com.terab.notification.support.NotificationIntegrationTestBase;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

class NotificationIntegrationTest extends NotificationIntegrationTestBase {

  @Autowired
  RabbitTemplate rabbitTemplate;

  @MockitoBean
  FcmPushService fcmPushService;

  // FirebaseMessaging Bean을 Mock으로 교체 (FirebaseConfig 초기화 우회)
  @MockitoBean
  FirebaseMessaging firebaseMessaging;

  @Test
  @DisplayName("RabbitMQ에 PushChallengeEvent 발행 시 FcmPushService.sendPushChallenge가 호출된다")
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
```

- [ ] **Step 5: 통합 테스트 실행 — PASS 확인**

```bash
cd services/notification && ./gradlew integrationTest --tests "com.terab.notification.integration.NotificationIntegrationTest" -i 2>&1 | tail -15
```

Expected: `BUILD SUCCESSFUL`, 1개 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add services/notification/src/intTest/ \
        services/notification/build.gradle
git commit -m "test: Notification MS RabbitMQ → FCM 통합 테스트 추가"
```

---

## Task 16: Notification MS Dockerfile

**Files:**
- Create: `services/notification/Dockerfile`

- [ ] **Step 1: Dockerfile 생성**

API 서비스 Dockerfile 패턴을 따른다. Firebase 서비스 계정 JSON은 Docker Secret(`/run/secrets/firebase-credentials`)으로 주입된다.

```dockerfile
# ─── Stage 1: Build ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew dependencies --no-daemon

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 2: Docker 빌드 확인**

```bash
cd services/notification && docker build -t terab-notification:test . 2>&1 | tail -5
```

Expected: `Successfully built` 또는 `naming to docker.io/library/terab-notification:test`.

- [ ] **Step 3: Commit**

```bash
git add services/notification/Dockerfile
git commit -m "feat: Notification MS Dockerfile 추가"
```

---

## Task 17: docker-compose.local.yml — notification 서비스 추가

**Files:**
- Modify: `docker-compose.local.yml`

- [ ] **Step 1: notification 서비스 추가**

`docker-compose.local.yml`의 `rabbitmq` 서비스 아래에 추가:

```yaml
  # ─── Notification MS ─────────────────────────────────────────────
  notification:
    build:
      context: ./services/notification
      dockerfile: Dockerfile
    container_name: terab-notification
    restart: on-failure
    ports:
      - '8082:8082'
    environment:
      SPRING_RABBITMQ_HOST: rabbitmq
      SPRING_RABBITMQ_USERNAME: terab
      SPRING_RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      FIREBASE_CREDENTIALS_PATH: /run/secrets/firebase-credentials
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - terab-net
```

> **로컬 Firebase 인증:** `FIREBASE_CREDENTIALS_PATH`를 실제 서비스 계정 JSON 파일 경로로 설정해야 한다. 로컬에서 `docker compose`로 실행 시, 이 파일을 볼륨 마운트하거나 절대 경로를 제공한다. Push 알림 없이 기능 테스트만 하려면 Notification MS를 제외하고 `make infra`만 실행해도 무방하다.

- [ ] **Step 2: 전체 통합 확인 (make infra 기반 스모크 테스트)**

```bash
make infra           # DB + MinIO + RabbitMQ 기동
sleep 5
make api &           # API 서버 실행 (백그라운드)
sleep 20
curl -s http://localhost:8080/actuator/health | python3 -m json.tool
```

Expected: `"status": "UP"` 포함.

```bash
# Push Token 등록 API 스모크 테스트 (로그인 후 accessToken 획득 필요)
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"owner1234"}')
ACCESS_TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -X POST http://localhost:8080/api/auth/devices/push-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"pushToken":"test-token-001","platform":"android","name":"Test Device"}' \
  | python3 -m json.tool
```

Expected: `{ "deviceId": "<uuid>" }` 출력.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.local.yml
git commit -m "feat: docker-compose에 Notification MS 서비스 추가"
```

---

## 전체 테스트 실행 확인

- [ ] **API 전체 테스트**

```bash
cd services/api && ./gradlew check 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Notification MS 전체 테스트**

```bash
cd services/notification && ./gradlew check 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`

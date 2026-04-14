# Notification MS 설계

**날짜:** 2026-04-14
**범위:** DEV-007 (Notification MS), DEV-008 (FCM/APNs Push 채널)
**관련 요구사항:** NOTIF-01, NOTIF-02
**다음 단계:** Mobile 앱 (DEV-009~011) 은 별도 플랜으로 분리

---

## 결정 사항 요약

| 항목 | 결정 |
| --- | --- |
| MQ Exchange 방식 | Topic Exchange (`terab.events`) |
| 메시징 추상화 | Spring Cloud Stream (binder 교체로 MQ 변경 가능) |
| Push 플랫폼 | Firebase Admin SDK 단일화 (Android FCM + iOS FCM→APNs 프록시) |
| v0.2.0 Email 확장 | 이번 설계에서 제외 — Push 전용 집중 |
| 디바이스 관리 UI | 이번 단계 제외 (D-10a, DEV-018은 Phase 3) |

---

## 섹션 1 — 전체 아키텍처

### 데이터 흐름

```
[API 서비스] ─publish(routing key: auth.2fa.challenge)─▶ [RabbitMQ: terab.events]
                                                                    │
                                              binding: auth.#       │
                                                                    ▼
                                                      [Notification MS]
                                                            │
                                                   Firebase Admin SDK
                                                            │
                                              ┌─────────────┴─────────────┐
                                           [FCM]                       [APNs]
                                        (Android)                   (iOS, via FCM proxy)
                                              │                           │
                                              └───────────────────────────┘
                                                            │
                                                      [Mobile App]
```

### Push Token 등록 흐름

```
[Mobile App] ─POST /api/auth/devices/push-token─▶ [API 서비스] ─저장─▶ [PostgreSQL: devices]
```

### Spring Cloud Stream 추상화

API 서비스와 Notification MS 모두 `spring-cloud-stream`을 사용한다.
현재 binder는 RabbitMQ. 나중에 Redis Streams, Kafka 등으로 교체 시:

- `build.gradle` dependency 교체 (`spring-cloud-starter-stream-rabbit` → `spring-cloud-starter-stream-redis` 등)
- `application.yml` binding 설정 변경
- **비즈니스 로직 코드 변경 없음**

---

## 섹션 2 — Notification MS 구조

### 디렉토리

```
services/notification/
├── build.gradle
├── settings.gradle
├── Dockerfile
└── src/
    ├── main/
    │   ├── java/com/terab/notification/
    │   │   ├── NotificationApplication.java
    │   │   ├── push/
    │   │   │   ├── consumer/
    │   │   │   │   └── PushEventConsumer.java      # Cloud Stream @Bean Consumer
    │   │   │   ├── service/
    │   │   │   │   └── FcmPushService.java         # Firebase Admin SDK 호출
    │   │   │   └── dto/
    │   │   │       └── PushChallengeEvent.java     # 메시지 페이로드
    │   │   └── config/
    │   │       └── FirebaseConfig.java             # FirebaseApp 초기화
    │   └── resources/
    │       ├── application.yml
    │       └── application-local.yml
    └── test/
        └── java/com/terab/notification/
            └── push/
                └── consumer/
                    └── PushEventConsumerTest.java
```

### 핵심 의존성 (build.gradle)

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter'
    implementation 'org.springframework.cloud:spring-cloud-stream'
    implementation 'org.springframework.cloud:spring-cloud-starter-stream-rabbit'
    implementation 'com.google.firebase:firebase-admin:9.3.0'
}
```

### 메시지 계약 (PushChallengeEvent)

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "pushToken": "fcm-device-registration-token",
  "code": "47",
  "challengeId": "550e8400-e29b-41d4-a716-446655440001",
  "expiresAt": "2026-04-14T10:05:00Z"
}
```

### application.yml (Notification MS)

```yaml
spring:
  cloud:
    stream:
      bindings:
        processPushChallenge-in-0:
          destination: terab.events
          group: notification-push
      rabbit:
        bindings:
          processPushChallenge-in-0:
            consumer:
              binding-routing-key: auth.2fa.challenge
```

---

## 섹션 3 — API 서비스 변경사항

### 신규 파일

```
services/api/src/main/java/com/terab/api/
├── notification/
│   └── publisher/
│       └── PushChallengePublisher.java   # StreamBridge로 이벤트 발행
└── device/
    ├── domain/
    │   └── Device.java
    ├── repository/
    │   └── DeviceRepository.java
    └── controller/
        └── DeviceController.java         # POST /api/auth/devices/push-token
```

### 변경 파일

- `AuthService.java` — `createChallenge()` 내부에서 `PushChallengePublisher.publish()` 호출
- `SecurityConfig.java` — 변경 없음 (`/api/**` 인증 필요 규칙으로 자동 적용)

### 이벤트 발행 흐름 (AuthService)

```
createChallenge(userId):
  1. twofa_challenges에 챌린지 생성 (code, expires_at)
  2. devices 테이블에서 userId로 pushToken 조회
  3. pushToken 없으면 → 예외 (Push 2FA 불가)
  4. PushChallengePublisher.publish(PushChallengeEvent)
  5. 202 { challengeId, code } 반환
```

### application.yml (API 서비스 추가)

```yaml
spring:
  cloud:
    stream:
      bindings:
        terab-events-out-0:
          destination: terab.events
      rabbit:
        bindings:
          terab-events-out-0:
            producer:
              routing-key-expression: headers['routingKey']
```

---

## 섹션 4 — DB 변경 (V3 migration)

```sql
-- V3__devices.sql

CREATE TABLE devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200),           -- "Chrome on MacBook" (옵션, 앱이 전송)
  push_token   VARCHAR(500),           -- FCM 등록 토큰
  platform     VARCHAR(10) NOT NULL,   -- 'android' | 'ios'
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
```

**API 엔드포인트:**

| Method | Path                           | 설명               | 인증         |
|--------|--------------------------------|--------------------|--------------|
| `POST` | `/api/auth/devices/push-token` | FCM 토큰 등록/갱신 | Access Token |

```
POST /api/auth/devices/push-token
Request:  { pushToken, platform, name? }
Response: 200 { deviceId }
```

> Device 관리 UI (D-10a: 목록 조회/연결 해제)는 DEV-018 (Phase 3)에서 구현.

---

## 섹션 5 — 인프라

### Docker Compose (로컬 개발)

`docker-compose.yml`에 추가:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"   # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: terab
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  notification:
    build: ./services/notification
    ports:
      - "8082:8082"
    depends_on:
      - rabbitmq
    environment:
      SPRING_RABBITMQ_HOST: rabbitmq
      SPRING_RABBITMQ_USERNAME: terab
      SPRING_RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      FIREBASE_CREDENTIALS_PATH: /run/secrets/firebase-credentials

volumes:
  rabbitmq_data:
```

### Makefile 추가 커맨드

```makefile
notification:   # Notification MS 개발 서버 실행
infra:          # rabbitmq 포함 (기존 db/minio에 추가)
```

### Docker Swarm (운영)

`configs.env`에 `RABBITMQ_PASSWORD` 추가.
Firebase 서비스 계정 JSON은 Docker Secret으로 주입 (`firebase-credentials`).

---

## 섹션 6 — 테스트 전략

| 레이어 | 대상 | 방법 |
| --- | --- | --- |
| Unit | `FcmPushService` | Firebase Admin SDK Mock |
| Unit | `PushEventConsumer` | `FcmPushService` Mock |
| Slice | `DeviceController` | `@WebMvcTest` + MockMvc |
| Integration | `PushChallengePublisher` → RabbitMQ → `PushEventConsumer` | Testcontainers RabbitMQ |

---

## 파일 맵 요약

### Notification MS — 신규 생성

```
services/notification/build.gradle
services/notification/settings.gradle
services/notification/Dockerfile
services/notification/src/main/java/com/terab/notification/NotificationApplication.java
services/notification/src/main/java/com/terab/notification/config/FirebaseConfig.java
services/notification/src/main/java/com/terab/notification/push/dto/PushChallengeEvent.java
services/notification/src/main/java/com/terab/notification/push/consumer/PushEventConsumer.java
services/notification/src/main/java/com/terab/notification/push/service/FcmPushService.java
services/notification/src/main/resources/application.yml
services/notification/src/main/resources/application-local.yml
services/notification/src/test/java/com/terab/notification/push/consumer/PushEventConsumerTest.java
```

### API 서비스 — 신규 생성

```
services/api/src/main/java/com/terab/api/notification/publisher/PushChallengePublisher.java
services/api/src/main/java/com/terab/api/device/domain/Device.java
services/api/src/main/java/com/terab/api/device/repository/DeviceRepository.java
services/api/src/main/java/com/terab/api/device/controller/DeviceController.java
services/api/src/main/resources/db/migration/V3__devices.sql
```

### API 서비스 — 수정

```
services/api/src/main/java/com/terab/api/auth/service/AuthService.java
services/api/src/main/java/com/terab/api/security/SecurityConfig.java
services/api/src/main/resources/application.yml
services/api/build.gradle                                            (spring-cloud-stream 추가)
```

### 인프라 — 수정

```
docker-compose.yml      (rabbitmq, notification 서비스 추가)
Makefile                (notification, infra 커맨드 확장)
```

---

## 변경 이력

| 날짜       | 변경 내용                                                          |
|------------|--------------------------------------------------------------------|
| 2026-04-14 | 초기 설계 수립 (Notification MS + FCM Push, Spring Cloud Stream)   |

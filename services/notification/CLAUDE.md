# services/notification/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다. 공통 원칙은 루트 CLAUDE.md를 참조하세요.

## 아키텍처 개요

### 역할

HTTP 엔드포인트 없음. MQ 이벤트 수신 전용.

```
MQ Event (RabbitMQ)
  → Consumer (@Bean)
  → Service (채널별 발송 로직)
  → External API (FCM, SMTP 등)
```

### 패키지 구조

채널 중심(channel-based) 구조.

```
com.terab.notification/
  {channel}/              ← 알림 채널 단위 (push, email 등)
    consumer/             ← Spring Cloud Stream Consumer @Bean — 진입점
    service/              ← 채널별 발송 비즈니스 로직
    dto/                  ← MQ 이벤트 페이로드 (Java record)
  config/                 ← 인프라 Bean 설정 (Firebase, AMQP 등)
  common/                 ← 공통 유틸 (필요 시)
```

**application 레이어**: 현재는 Consumer → Service 직접 호출로 충분. 복수 채널 서비스 조합이나 공통 사전 처리(사용자 설정 체크 등)가 필요한 시점에 `application/`, `application/interfaces/` 도입.

### api 서비스와의 비교

| 항목 | api 서비스 | notification 서비스 |
|------|-----------|-------------------|
| 진입점 | HTTP Controller | MQ Consumer |
| 흐름 조율 | UseCase (application/) | 없음 (단순 위임 시) |
| 저장소 | Repository + Flyway | 없음 |
| 예외 | `ApiException(ErrorCode)` | `RuntimeException` |
| 보안 | Spring Security + JWT | 없음 |

### 주요 명령어

```bash
./gradlew bootRun           # 로컬 실행
./gradlew test              # 단위 테스트
./gradlew integrationTest   # 통합 테스트 (Docker 필요)
./gradlew check             # 전체 테스트
./gradlew build             # 빌드 (JAR 생성)
```

## Spring Cloud Stream 바인딩 컨벤션

### Consumer Bean 패턴

Consumer는 `@Configuration` + `@Bean` 조합으로 선언한다.

```java
@Configuration
@RequiredArgsConstructor
public class PushEventConsumer {
    private final FcmPushService fcmPushService;

    @Bean
    public Consumer<PushChallengeEvent> processPushChallenge() {
        return fcmPushService::sendPushChallenge;
    }
    // 바인딩명: processPushChallenge-in-0
}
```

### application.yml 바인딩 규칙

| 항목 | 컨벤션 | 예시 |
|------|--------|------|
| `definition` | Bean 메서드명 쉼표 구분 | `processPushChallenge,processFoo` |
| `destination` | `terab.events` 고정 (Topic Exchange) | `terab.events` |
| `group` | `notification-{channel}` | `notification-push` |
| `binding-routing-key` | `{domain}.{action}` | `auth.2fa.challenge` |
| `exchange-type` | `topic` 고정 | `topic` |

### 새 이벤트 추가 체크리스트

1. `{channel}/dto/` — 이벤트 record 추가
2. `{channel}/service/` — 발송 서비스 구현
3. `{channel}/consumer/` — Consumer `@Bean` 메서드 추가
4. `application.yml` — `definition`에 Bean명 추가, 바인딩 블록 추가
5. 단위 테스트 추가 (Service + Consumer)

## 예외 처리

HTTP 응답이 없으므로 api 서비스의 `ApiException` 패턴을 사용하지 않는다. `RuntimeException`을 throw하면 Spring Cloud Stream이 재시도/DLQ로 처리한다.

```java
// ✅
throw new RuntimeException("FCM 전송 실패: " + e.getMessage(), e);

// ❌ — 이 서비스에서 사용 금지
throw new ApiException(ErrorCode.XXX);
```

`ApiException`, `ErrorCode`, `GlobalExceptionHandler`는 이 서비스에 존재하지 않는다.

## 테스트 컨벤션

### 테스트 계층

| 대상 | 계층 | 위치 |
|------|------|------|
| Service (발송 로직) | Unit (Mockito) | `src/test/.../unit/{channel}/` |
| Consumer (Service 위임) | Unit (Mockito) | `src/test/.../unit/{channel}/` |
| MQ → Consumer → Service 전체 흐름 | Integration (Testcontainers) | `src/intTest/.../integration/` |

### 작성 규칙

- `@WebMvcTest` 슬라이스 없음 — HTTP 레이어가 없으므로
- Integration Test에서 FCM은 `@MockitoBean`으로 교체 — 실제 Firebase 호출 금지
- RabbitMQ는 Testcontainers로 실제 기동 (`TestContainersConfig`)
- 메서드명: `should_동작_when_조건`
- `@Nested` + `@DisplayName` 그룹화
- Given / When / Then 주석

## Javadoc · 주석 정책

api 서비스와 동일. `/** */` Javadoc 불필요. 주석은 **왜(why)** 설명 시에만, 한글로 작성.

```java
// ✅ — 소비자 바인딩이 Exchange를 먼저 생성하므로 타입 충돌 없이 직접 발행 가능
rabbitTemplate.convertAndSend("terab.events", "auth.2fa.challenge", event);
```

## Claude 행동 지침 (Notification)

- 새 채널 추가 시 `{channel}/dto · service · consumer` 구조를 따른다
- 새 이벤트 추가 시 `application.yml`의 `definition`과 바인딩 블록을 반드시 함께 수정한다
- `ApiException`, `ErrorCode`는 이 서비스에 사용하지 않는다 — `RuntimeException` 사용
- 테스트 작성 계층은 위 기준표를 따른다 — 모든 신규 기능에 최소 Unit 테스트 포함
- `application-local.yml`, `application-*.yml` 환경 설정 파일 수정 전 반드시 확인
- Consumer가 다른 채널의 Service를 직접 주입받는 코드는 작성하지 않는다

# Service Layer

> 비즈니스 로직의 유일한 위치. 트랜잭션 경계를 여기서 결정한다.

## 요약 테이블

| 어노테이션/속성 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@Service` | ★★★ | 빈 등록 + 레이어 명시 | 클래스 | — |
| `@Transactional` | ★★★ | 트랜잭션 경계 설정 | 클래스/메서드 | self-invocation 함정 |
| `readOnly=true` | ★★★ | 조회 전용 최적화 | 속성 | 쓰기 시도 시 예외 |
| `Propagation.REQUIRED` | ★★☆ | 기존 트랜잭션 참여 (기본값) | 속성 | — |
| `Propagation.REQUIRES_NEW` | ★☆☆ | 독립 트랜잭션 강제 생성 | 속성 | 중첩 커밋/롤백 독립 |
| `rollbackFor` | ★★☆ | 롤백 대상 예외 명시 | 속성 | CheckedException 기본 미롤백 |
| `Isolation.READ_COMMITTED` | ★★☆ | 커밋된 데이터만 읽기 (기본값) | 속성 | DB 기본값과 일치 여부 확인 |
| `@Async` | ★☆☆ | 비동기 실행 | 메서드 | `@EnableAsync` 필수 |

---

## @Service

Spring이 `@Component`의 특수화로 처리. 기술적 차이는 없지만 레이어 명시와 AOP 포인트컷 지정에 사용된다.

```java
@Service
@RequiredArgsConstructor  // Lombok: final 필드 생성자 자동 생성
public class AuthService {

    private final UserRepository userRepository;
    private final JwtProvider jwtProvider;
}
```

---

## @Transactional

### 내부 동작 원리 (프록시 기반 AOP)

Spring은 `@Transactional`이 붙은 빈을 그대로 주입하지 않고 **프록시 객체**로 감싸서 주입한다.
메서드 호출 시 프록시가 `PlatformTransactionManager`를 통해 트랜잭션을 시작/커밋/롤백한다.

```
Controller → [Proxy: 트랜잭션 시작] → AuthService.login() → [Proxy: 커밋/롤백]
```

### 기본 사용 패턴

```java
@Service
@Transactional(readOnly = true)  // 클래스 레벨: 기본값 readOnly
public class FileService {

    @Transactional  // 메서드 레벨: 쓰기 필요 시 오버라이드 (readOnly=false)
    public FileResponse upload(UploadFileRequest request) {
        // INSERT/UPDATE/DELETE 작업
    }

    public FileResponse findById(UUID id) {
        // readOnly=true 상속 — dirty checking 생략, 성능 향상
    }
}
```

### readOnly=true 효과

1. **Dirty Checking 생략** — 영속성 컨텍스트가 스냅샷을 생성하지 않아 메모리 절약
2. **DB 최적화** — 일부 JDBC 드라이버/DB가 읽기 전용 힌트를 받아 슬레이브 라우팅 가능
3. **실수 방지** — 조회 메서드에서 엔티티를 수정해도 DB에 반영되지 않음

### Propagation (전파 레벨)

| 레벨 | 동작 | 사용 시점 |
|---|---|---|
| `REQUIRED` (기본값) | 트랜잭션 있으면 참여, 없으면 새로 시작 | 대부분의 경우 |
| `REQUIRES_NEW` | 항상 새 트랜잭션 시작, 기존 트랜잭션 일시 중단 | 감사 로그처럼 독립 커밋 필요 시 |
| `NESTED` | SavePoint 활용 중첩 트랜잭션 | 부분 롤백이 필요한 복잡한 처리 |
| `SUPPORTS` | 트랜잭션 있으면 참여, 없으면 트랜잭션 없이 실행 | 읽기 전용 유틸 메서드 |
| `NOT_SUPPORTED` | 트랜잭션 없이 실행, 기존 것 일시 중단 | 트랜잭션 불필요한 작업 강제 분리 |
| `NEVER` | 트랜잭션 있으면 예외 발생 | 트랜잭션이 있으면 안 되는 작업 |
| `MANDATORY` | 트랜잭션 없으면 예외 발생 | 반드시 트랜잭션 안에서만 호출해야 하는 메서드 |

```java
// REQUIRES_NEW 예시: 감사 로그는 메인 트랜잭션 롤백과 무관하게 기록
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordAuditLog(AuditEvent event) {
    auditRepository.save(AuditLog.from(event));
}
```

### rollbackFor

기본적으로 `RuntimeException`과 `Error`만 롤백. `CheckedException`은 롤백하지 않는다.

```java
// ✅ CheckedException도 롤백하려면 명시
@Transactional(rollbackFor = Exception.class)
public void processFile(UUID id) throws IOException {
    // IOException 발생 시에도 롤백됨
}

// ❌ 기본값 — IOException은 롤백 안 됨
@Transactional
public void processFile(UUID id) throws IOException { }
```

### Self-invocation 함정

같은 클래스 내부에서 `@Transactional` 메서드를 직접 호출하면 프록시를 거치지 않아 트랜잭션이 적용되지 않는다.

```java
@Service
public class FileService {

    @Transactional
    public void upload(UploadFileRequest request) {
        // ...
        this.notifyUpload(request);  // ❌ 프록시 우회 — @Transactional 무시
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUpload(UploadFileRequest request) {
        // 독립 트랜잭션으로 동작하지 않음
    }
}
```

해결책: `notifyUpload`를 별도 서비스 빈으로 분리.

---

## @Async

별도 스레드에서 메서드를 비동기 실행. MQ 없이 간단한 비동기 처리 시 사용.

```java
// 1. 활성화 (Application 클래스 또는 Config 클래스에)
@EnableAsync
@SpringBootApplication
public class TeraBApplication { }

// 2. 비동기 메서드
@Async
@Transactional
public CompletableFuture<Void> sendPushNotification(UUID userId, String message) {
    // 별도 스레드에서 실행 — 호출자는 즉시 반환
    notificationClient.send(userId, message);
    return CompletableFuture.completedFuture(null);
}
```

> **주의:** `@Async`도 self-invocation 함정이 있다. 같은 클래스에서 호출하면 동기 실행된다.

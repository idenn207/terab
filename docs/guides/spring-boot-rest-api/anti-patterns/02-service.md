# 안티패턴 — Service Layer

[← 목차로 돌아가기](./README.md)

---

## AP-06: `@Transactional` Self-invocation

**위험도:** 🔵 유지보수 문제 (트랜잭션 미적용)

**왜 문제인가:**
`@Transactional`은 Spring AOP 프록시를 통해 동작한다. 같은 클래스 내에서 `this.method()`로 호출하면
프록시를 거치지 않고 실제 객체의 메서드가 직접 호출되어 `@Transactional`이 무시된다.

```java
// ❌
@Service
public class NotificationService {

    @Transactional
    public void processAndNotify(UUID fileId) {
        process(fileId);
        this.sendNotification(fileId);  // 프록시 우회 — @Transactional 무시
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNotification(UUID fileId) {
        // 독립 트랜잭션으로 동작하지 않음
    }
}

// ✅ — 별도 빈으로 분리
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final FileRepository fileRepository;
    private final NotificationSender notificationSender;  // 별도 빈

    @Transactional
    public void processAndNotify(UUID fileId) {
        fileRepository.markAsProcessed(fileId);  // 메인 트랜잭션 내 처리
        notificationSender.sendNotification(fileId);  // 프록시를 통한 호출 — REQUIRES_NEW 적용됨
    }
}

@Service
@RequiredArgsConstructor
public class NotificationSender {

    private final NotificationRepository notificationRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNotification(UUID fileId) {
        notificationRepository.save(Notification.of(fileId));  // 독립 트랜잭션으로 커밋
    }
}
```

---

## AP-07: `@Transactional(readOnly=true)` 미사용

**위험도:** 🟡 성능 저하

**왜 문제인가:**
`readOnly=false`(기본값)이면 JPA는 트랜잭션 종료 시 모든 MANAGED 엔티티에 대해
스냅샷 비교(dirty checking)를 수행한다. 조회 전용 메서드에서는 불필요한 CPU/메모리 낭비다.

```java
// ❌
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileRepository fileRepository;

    @Transactional  // readOnly=true 미설정 — 트랜잭션 종료 시 dirty checking 수행
    public FileResponse findById(UUID id) {
        File file = fileRepository.findById(id).orElseThrow(
            () -> new ApiException(ErrorCode.FILE_NOT_FOUND)
        );
        return FileResponse.from(file);  // 조회만 하는데 스냅샷 비교 비용 낭비
    }
}

// ✅
@Service
@Transactional(readOnly = true)  // 클래스 기본값: 모든 메서드 readOnly
@RequiredArgsConstructor
public class FileService {

    private final FileRepository fileRepository;

    public FileResponse findById(UUID id) {
        // dirty checking 생략
        File file = fileRepository.findById(id).orElseThrow(
            () -> new ApiException(ErrorCode.FILE_NOT_FOUND)
        );
        return FileResponse.from(file);
    }

    @Transactional  // 쓰기 메서드만 오버라이드 (readOnly=false)
    public FileResponse upload(UploadFileRequest request) { ... }
}
```

---

## AP-08: Service에서 `HttpServletRequest` 직접 참조

**위험도:** 🔵 유지보수 문제 (레이어 오염)

**왜 문제인가:**
Service가 HTTP 레이어(`HttpServletRequest`)에 의존하면:
1. HTTP 없이 Service를 단위 테스트할 수 없음 (Mocking 필요)
2. 스케줄러나 이벤트 리스너 같은 다른 진입점에서 Service 재사용 불가
3. 책임 분리 원칙 위반

```java
// ❌
@Service
public class AuthService {

    public LoginResponse login(HttpServletRequest request) {
        // Service가 HTTP 레이어에 직접 의존
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        // ... 비즈니스 로직
        return new LoginResponse(/* token */);
    }
}

// ✅ — Controller에서 필요한 값을 추출해 DTO로 전달
@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @RequestBody @Valid LoginRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(authService.login(request, clientIp));
    }
}

@Service
public class AuthService {
    public LoginResponse login(LoginRequest request, String clientIp) {
        // HTTP 독립 — 단위 테스트 용이
        // clientIp는 String으로 전달받아 HTTP 의존성 없음
        return new LoginResponse(/* token */);
    }
}
```

---

## AP-09: CheckedException `rollbackFor` 미설정

**위험도:** 🔴 데이터 손실

**왜 문제인가:**
`@Transactional`은 기본적으로 `RuntimeException`과 `Error`만 롤백한다.
`IOException`, `SQLException` 같은 CheckedException이 발생해도 트랜잭션이 커밋되어
데이터가 부분적으로만 저장되는 상황이 발생할 수 있다.

```java
// ❌
@Transactional
public void uploadFile(MultipartFile file) throws IOException {
    File fileEntity = fileRepository.save(File.from(file));  // DB 저장
    storageClient.upload(file.getBytes(), fileEntity.getId());  // IOException 가능
    // IOException 발생 시 DB는 커밋, 스토리지는 저장 안 됨 → 불일치
}

// ✅
@Transactional(rollbackFor = Exception.class)
public void uploadFile(MultipartFile file) throws IOException {
    File fileEntity = fileRepository.save(File.from(file));
    storageClient.upload(file.getBytes(), fileEntity.getId());
    // IOException 발생 시 DB도 롤백 → 일관성 유지
}
```

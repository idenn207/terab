# 안티패턴 — 예외 처리

[← 목차로 돌아가기](./README.md)

---

## AP-22: 빈 catch 블록 (예외 삼킴)

**위험도:** 🔵 디버깅 불가 (무음 실패)

**왜 문제인가:**
예외가 발생했지만 아무 흔적도 남지 않아 원인 파악이 불가능하다.
시스템은 정상 동작 중인 것처럼 보이지만 실제로는 오류가 발생하고 있다.

```java
// ❌
try {
    storageClient.delete(fileId);
} catch (Exception e) {
    // 아무것도 안 함 — 삭제 실패해도 모름
}

// ✅ — 최소한 로깅, 가능하면 예외 전파
try {
    storageClient.delete(fileId);
} catch (StorageException e) {
    log.error("파일 삭제 실패: fileId={}, error={}", fileId, e.getMessage(), e);
    throw new ApiException(ErrorCode.FILE_DELETE_FAILED);
}
```

---

## AP-23: `Exception` 전체 catch

**위험도:** 🔵 유지보수 문제

**왜 문제인가:**
`NullPointerException`, `OutOfMemoryError`, `InterruptedException` 같은 의도치 않은 예외까지
흡수해 시스템 상태를 예측할 수 없게 만든다. 또한 어떤 예외가 발생했는지 구분해 처리할 수 없다.

```java
// ❌
try {
    return userRepository.findById(id).orElseThrow();
} catch (Exception e) {
    return null;  // NoSuchElementException, NullPointerException 등 모두 null 반환
}

// ✅ — 처리 가능한 예외만 명시적으로 catch
User user = userRepository.findById(id)
    .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
// DataAccessException 등 DB 오류는 GlobalExceptionHandler가 처리
```

---

## AP-24: HTTP 200에 에러 응답 반환

**위험도:** 🔵 클라이언트 오류 감지 불가

**왜 문제인가:**
HTTP 상태코드는 클라이언트와 인프라(로드밸런서, 모니터링)가 성공/실패를 판단하는 기준이다.
200에 에러를 담아 반환하면 클라이언트가 응답 바디를 매번 파싱해야 하고,
Nginx 에러 페이지, Prometheus 알림 등 표준 인프라 도구가 동작하지 않는다.

```java
// ❌
@GetMapping("/{id}")
public ResponseEntity<Map<String, Object>> getUser(@PathVariable UUID id) {
    Optional<User> user = userRepository.findById(id);
    if (user.isEmpty()) {
        return ResponseEntity.ok(Map.of(
            "success", false,
            "message", "사용자를 찾을 수 없습니다"
        ));  // 404인데 200 반환
    }
    return ResponseEntity.ok(Map.of("success", true, "data", user.get()));
}

// ✅ — 적절한 HTTP 상태코드 사용
@GetMapping("/{id}")
public ResponseEntity<UserResponse> getUser(@PathVariable UUID id) {
    UserResponse response = userService.findById(id);  // 없으면 ApiException(404) 발생
    return ResponseEntity.ok(response);
}
```

---

## AP-25: `@RestControllerAdvice` 없이 예외 분산 처리

**위험도:** 🔵 유지보수 문제 (일관성 없는 에러 응답)

**왜 문제인가:**
Controller마다 `try-catch`를 두면 에러 응답 형식이 제각각이 된다.
클라이언트가 에러를 파싱하는 로직을 통일할 수 없고, 에러 포맷 변경 시 모든 Controller를 수정해야 한다.

```java
// ❌ Controller마다 예외 처리
@GetMapping("/{id}")
public ResponseEntity<?> getUser(@PathVariable UUID id) {
    try {
        return ResponseEntity.ok(userService.findById(id));
    } catch (UserNotFoundException e) {
        return ResponseEntity.status(404).body("사용자를 찾을 수 없습니다");
        // 다른 Controller는 다른 형식으로 반환
    }
}

// ✅ @RestControllerAdvice 중앙 처리 (terab GlobalExceptionHandler 패턴)
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException e) {
        return ResponseEntity
            .status(e.getErrorCode().getStatus())
            .body(ErrorResponse.of(e.getErrorCode()));
        // 모든 에러 응답이 ErrorResponse 형식으로 통일
    }
}

// Controller는 예외만 던지면 됨
@GetMapping("/{id}")
public ResponseEntity<UserResponse> getUser(@PathVariable UUID id) {
    return ResponseEntity.ok(userService.findById(id));
    // 없으면 GlobalExceptionHandler가 처리
}
```

# Controller Layer

> 요청 수신 → 파라미터 바인딩 → Service 위임 → 응답 반환. 비즈니스 로직은 절대 두지 않는다.

## 요약 테이블

| 어노테이션/타입 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@RestController` | ★★★ | HTTP 응답 자동 직렬화 | 클래스 | `@Controller`와 혼용 금지 |
| `@RequestMapping` | ★★★ | 공통 URL prefix 설정 | 클래스 | 메서드 레벨 중복 정의 주의 |
| `@GetMapping` | ★★★ | GET 요청 매핑 | 메서드 | — |
| `@PostMapping` | ★★★ | POST 요청 매핑 | 메서드 | `@RequestBody` 필수 페어 |
| `@PutMapping` | ★★☆ | 전체 리소스 교체 | 메서드 | PATCH와 용도 구분 |
| `@PatchMapping` | ★★☆ | 부분 업데이트 | 메서드 | — |
| `@DeleteMapping` | ★★☆ | 리소스 삭제 | 메서드 | — |
| `@PathVariable` | ★★★ | URL 경로 변수 바인딩 | 파라미터 | 타입 불일치 시 400 |
| `@RequestParam` | ★★☆ | 쿼리스트링 바인딩 | 파라미터 | `required` 기본값 `true` |
| `@RequestBody` | ★★★ | JSON → 객체 역직렬화 | 파라미터 | Entity 직접 바인딩 금지 |
| `@ResponseStatus` | ★★☆ | 응답 상태코드 고정 | 메서드 | `ResponseEntity`와 중복 주의 |
| `ResponseEntity<T>` | ★★★ | 상태코드+헤더+바디 제어 | 반환타입 | `void` 대신 권장 |

---

## @RestController

### 역할
`@Controller` + `@ResponseBody`의 합성 어노테이션. 반환값을 HTTP 응답 바디에 JSON으로 직렬화한다.

### 내부 동작 원리
`@ResponseBody`가 적용되면 `DispatcherServlet`이 `HandlerMethodReturnValueHandler` 체인을 통해
`HttpMessageConverter` 목록을 순회하고, 요청의 `Accept` 헤더와 반환 타입에 맞는 컨버터를 선택한다.
Spring Boot 기본 설정에서는 `MappingJackson2HttpMessageConverter`(Jackson)가 JSON 직렬화를 담당한다.

```java
// ✅ terab 스타일
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }
}
```

```java
// ❌ @Controller만 사용 — 반환값이 View 이름으로 해석됨 (Thymeleaf 등 없으면 오류)
@Controller
@RequestMapping("/api/auth")
public class AuthController { }
```

---

## HTTP 메서드 매핑

`@RequestMapping(method = RequestMethod.GET)`의 축약형.

| HTTP 메서드 | 어노테이션 | 의미 | 멱등성 | 요청 바디 |
|---|---|---|---|---|
| GET | `@GetMapping` | 조회 | O | X |
| POST | `@PostMapping` | 생성 | X | O |
| PUT | `@PutMapping` | 전체 교체 | O | O |
| PATCH | `@PatchMapping` | 부분 수정 | X | O |
| DELETE | `@DeleteMapping` | 삭제 | O | X |

```java
@RestController
@RequestMapping("/api/files")
public class FileController {

    @GetMapping                              // GET /api/files
    public ResponseEntity<List<FileResponse>> listFiles() { ... }

    @GetMapping("/{id}")                     // GET /api/files/{id}
    public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) { ... }

    @PostMapping                             // POST /api/files
    public ResponseEntity<FileResponse> uploadFile(
            @RequestBody @Valid UploadFileRequest request) { ... }

    @PatchMapping("/{id}/rename")            // PATCH /api/files/{id}/rename
    public ResponseEntity<FileResponse> renameFile(
            @PathVariable UUID id,
            @RequestBody @Valid RenameFileRequest request) { ... }

    @DeleteMapping("/{id}")                  // DELETE /api/files/{id}
    public ResponseEntity<Void> deleteFile(@PathVariable UUID id) { ... }
}
```

---

## 요청 바인딩

### @PathVariable

URL 경로의 `{변수명}`을 파라미터에 바인딩. 타입 변환은 Spring이 자동 처리한다.

```java
// GET /api/files/550e8400-e29b-41d4-a716-446655440000
@GetMapping("/{id}")
public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) {
    // UUID 파싱 실패 시 자동으로 400 Bad Request 반환
    return ResponseEntity.ok(fileService.findById(id));
}

// 변수명이 다를 때 명시
@GetMapping("/{fileId}/shares")
public ResponseEntity<List<ShareResponse>> getShares(@PathVariable("fileId") UUID id) { ... }
```

### @RequestParam

쿼리스트링(`?key=value`)을 파라미터에 바인딩.

```java
// GET /api/files?page=0&size=20&folderId=...
@GetMapping
public ResponseEntity<Page<FileResponse>> listFiles(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) UUID folderId) {
    // defaultValue 지정 시 자동으로 required=false
    // required=false + defaultValue 없으면 파라미터 미포함 시 null
}
```

### @RequestBody

HTTP 요청 바디의 JSON을 객체로 역직렬화. `@Valid`와 함께 사용해 Bean Validation을 적용한다.

```java
@PostMapping("/login")
public ResponseEntity<LoginResponse> login(@RequestBody @Valid LoginRequest request) {
    // @Valid 실패 → MethodArgumentNotValidException → GlobalExceptionHandler에서 400 반환
    return ResponseEntity.ok(authService.login(request));
}
```

---

## 응답 제어

### ResponseEntity<T>

HTTP 상태코드 + 응답 헤더 + 바디를 모두 제어. 동적인 상태코드가 필요할 때 사용한다.

```java
// 201 Created — 생성 성공
return ResponseEntity.status(HttpStatus.CREATED).body(response);

// 200 OK
return ResponseEntity.ok(response);

// 204 No Content — 삭제 성공
return ResponseEntity.noContent().build();

// 404 Not Found
return ResponseEntity.notFound().build();
```

### HTTP 상태코드 관례

| 상황 | 코드 |
|---|---|
| 조회 성공 | 200 OK |
| 생성 성공 | 201 Created |
| 수정/삭제 성공 (바디 없음) | 204 No Content |
| 유효성 검증 실패 | 400 Bad Request |
| 인증 토큰 없음/만료 | 401 Unauthorized |
| 권한 없음 | 403 Forbidden |
| 리소스 없음 | 404 Not Found |
| 중복 (이미 존재) | 409 Conflict |

### @ResponseStatus vs ResponseEntity

```java
// @ResponseStatus: 항상 동일한 상태코드 — 간단한 경우만
@ResponseStatus(HttpStatus.NO_CONTENT)
@DeleteMapping("/{id}")
public void deleteFile(@PathVariable UUID id) {
    fileService.delete(id);
}

// ResponseEntity: 조건부 상태코드 또는 헤더 제어 필요 시 — 권장
@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteFile(@PathVariable UUID id) {
    fileService.delete(id);
    return ResponseEntity.noContent().build();
}
```

둘을 함께 쓰면 `@ResponseStatus`가 무시되므로 하나만 선택.

---

## 예외 처리

### @RestControllerAdvice + @ExceptionHandler

모든 Controller에서 발생하는 예외를 중앙에서 처리. terab `GlobalExceptionHandler` 패턴:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 비즈니스 예외 (ApiException + ErrorCode)
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity
                .status(code.getStatus())
                .body(ErrorResponse.of(code));
    }

    // Bean Validation 실패 (@Valid)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.ofValidation(e.getBindingResult()));
    }

    // 예상치 못한 예외 — 500
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.ofMessage("서버 오류가 발생했습니다."));
    }
}
```

> **동작 원리:** `@RestControllerAdvice`는 `@ControllerAdvice` + `@ResponseBody`의 합성. AOP가 아니라 `ExceptionHandlerExceptionResolver`가 예외를 가로채 처리한다.

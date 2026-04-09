# Spring Boot REST API 가이드 문서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** terab 프로젝트 기반 Spring Boot REST API 개발 가이드 14개 마크다운 파일 생성

**Architecture:** 레이어별 가이드(01~06) + 2단계 안티패턴 가이드(anti-patterns/) 구조. 각 파일 상단에 요약 테이블, 본문에 terab 스타일 코드 예시 + 내부 동작 원리 포함.

**Tech Stack:** Markdown, Java 21, Spring Boot 3.x, Lombok, JPA/Hibernate, Spring Security 6.x, Flyway

---

## 파일 구조

```
docs/guides/spring-boot-rest-api/
├── README.md                          ← 전체 목차
├── 01-controller-layer.md             ← 12개 어노테이션/타입
├── 02-service-layer.md                ← 8개 어노테이션/속성
├── 03-jpa-repository-layer.md         ← 13개 어노테이션
├── 04-security-auth.md                ← 7개 어노테이션/설정
├── 05-db-migration.md                 ← 6개 설정/규칙
├── 06-quick-reference.md              ← 카테고리별 색인
└── anti-patterns/
    ├── README.md                      ← 29개 안티패턴 요약
    ├── 01-controller.md               ← AP-01~05
    ├── 02-service.md                  ← AP-06~09
    ├── 03-jpa-repository.md           ← AP-10~16
    ├── 04-db-migration.md             ← AP-17~21
    ├── 05-exception-handling.md       ← AP-22~25
    └── 06-security.md                 ← AP-26~29
```

---

## Task 1: README.md — 전체 목차

**Files:**
- Create: `docs/guides/spring-boot-rest-api/README.md`

- [x] **Step 1: README.md 생성**

```markdown
# Spring Boot REST API 가이드

> terab 프로젝트(Java 21 + Spring Boot 3.x) 기반 개인 개발 참고용 치트시트

## 레이어별 가이드

| # | 파일 | 주요 내용 |
|---|------|-----------|
| 01 | [Controller Layer](./01-controller-layer.md) | 요청 매핑, 바인딩, 응답 제어, 예외 처리 |
| 02 | [Service Layer](./02-service-layer.md) | 트랜잭션, Propagation, Isolation, AOP 원리 |
| 03 | [JPA / Repository Layer](./03-jpa-repository-layer.md) | 엔티티, 연관관계, Lombok + JPA 패턴 |
| 04 | [Security / Auth](./04-security-auth.md) | JWT 필터, RBAC, 권한 검증 어노테이션 |
| 05 | [DB Migration](./05-db-migration.md) | Flyway, ddl-auto 옵션, 마이그레이션 원칙 |

## Quick Reference

- [카테고리별 어노테이션 전체 색인](./06-quick-reference.md)

## 안티패턴 가이드

- [안티패턴 목차 및 전체 목록 (29개)](./anti-patterns/README.md)

---

## 프로젝트 컨벤션 (terab 기준)

| 항목 | 컨벤션 |
|------|--------|
| PK 타입 | `UUID` — `@GeneratedValue(strategy = GenerationType.UUID)` |
| Lombok 패턴 | `@Getter` + `@Builder` + `@NoArgsConstructor(access = PROTECTED)` + `@AllArgsConstructor` |
| DTO 패턴 | `XxxRequest` / `XxxResponse` 분리 (Entity 직접 노출 금지) |
| 예외 패턴 | `ApiException(ErrorCode)` → `GlobalExceptionHandler` (`@RestControllerAdvice`) |
| 권한 형식 | `리소스:액션` (예: `file:read`, `user:manage`, `system:config`) |
| 패키지 구조 | `{domain}/controller`, `{domain}/service`, `{domain}/repository`, `{domain}/domain`, `{domain}/dto` |
| 기본 URL prefix | `/api/{domain}` (예: `/api/auth`, `/api/files`, `/api/users`) |
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/README.md
git commit -m "docs: Spring Boot REST API 가이드 목차 파일 추가"
```

---

## Task 2: 01-controller-layer.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/01-controller-layer.md`

- [x] **Step 1: 파일 생성**

```markdown
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
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/01-controller-layer.md
git commit -m "docs: Controller Layer 가이드 추가"
```

---

## Task 3: 02-service-layer.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/02-service-layer.md`

- [x] **Step 1: 파일 생성**

```markdown
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
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/02-service-layer.md
git commit -m "docs: Service Layer 가이드 추가"
```

---

## Task 4: 03-jpa-repository-layer.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/03-jpa-repository-layer.md`

- [x] **Step 1: 파일 생성**

```markdown
# JPA / Repository Layer

> 데이터 접근 계층. 엔티티 설계와 연관관계 매핑이 핵심이다.

## 요약 테이블

| 어노테이션 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@Entity` | ★★★ | JPA 엔티티 등록 | 클래스 | Lombok `@Data` 금지 |
| `@Table` | ★★☆ | 테이블명/인덱스 명시 | 클래스 | 생략 시 클래스명 사용 |
| `@Id` | ★★★ | PK 지정 | 필드 | 복합키는 `@EmbeddedId` |
| `@GeneratedValue` | ★★★ | PK 자동생성 전략 | 필드 | UUID vs IDENTITY 선택 |
| `@Column` | ★★★ | 컬럼 제약조건 명시 | 필드 | `nullable=false` 권장 |
| `@OneToMany` | ★★★ | 1:N 관계 매핑 | 필드 | `FetchType.LAZY` 확인 |
| `@ManyToOne` | ★★★ | N:1 관계 매핑 (연관관계 주인) | 필드 | `@JoinColumn` 필수 |
| `@ManyToMany` | ★☆☆ | M:N (중간 엔티티 대체 권장) | 필드 | 실무 사용 지양 |
| `@OneToOne` | ★★☆ | 1:1 관계 매핑 | 필드 | 지연로딩 별도 설정 필요 |
| `@Embedded` | ★★☆ | 값 타입 임베딩 | 필드 | — |
| `@Query` | ★★☆ | 커스텀 JPQL 작성 | 메서드 | 파라미터 바인딩 필수 |
| `@EntityGraph` | ★★☆ | N+1 해결 fetch join 명시 | 메서드 | 복잡 쿼리엔 QueryDSL |
| `@NoArgsConstructor(PROTECTED)` | ★★★ | JPA 기본 생성자 | 클래스 | `PUBLIC` 금지 |

---

## 엔티티 기본 패턴 (terab 스타일)

terab의 `Permission.java`에서 확립된 Lombok + JPA 조합 패턴:

```java
@Entity
@Table(name = "permissions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)  // JPA용 기본 생성자 — 외부 직접 호출 금지
@Builder
@AllArgsConstructor
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)  // terab 표준: UUID PK
    private UUID id;

    @Column(nullable = false, length = 50)
    private String resource;

    @Column(nullable = false, length = 50)
    private String action;

    public String toPermissionString() {
        return resource + ":" + action;
    }
}
```

**왜 `@NoArgsConstructor(access = PROTECTED)`인가?**
JPA는 리플렉션으로 엔티티를 인스턴스화할 때 기본 생성자가 필요하다. `PROTECTED`로 설정하면
외부에서 `new Permission()`처럼 호출하는 실수를 방지하고 `@Builder` 패턴 사용을 강제한다.

---

## @GeneratedValue 전략

| 전략 | 동작 | 장점 | 단점 |
|---|---|---|---|
| `IDENTITY` | DB auto-increment | 숫자 PK, 직관적 | 배치 INSERT 최적화 어려움 |
| `SEQUENCE` | DB 시퀀스 사용 | 배치 INSERT 최적화 가능 | PostgreSQL 전용 설정 필요 |
| `UUID` (Java 생성) | 애플리케이션에서 UUID 생성 | DB 독립적, IDOR 방어 | 인덱스 효율 다소 낮음 |
| `AUTO` | DB 방언에 따라 자동 선택 | 편의성 | 예측 불가, 지양 |

> terab은 보안(IDOR 방어)과 DB 독립성을 위해 `GenerationType.UUID` 사용.

---

## 연관관계 매핑

### 연관관계 주인

양방향 매핑에서 **외래키를 관리하는 쪽(N쪽)이 연관관계 주인**이다.
`@JoinColumn`이 있는 쪽이 주인. 주인만이 INSERT/UPDATE를 담당한다.

```java
// User (1) : Role (N) 예시
@Entity
public class User {
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    // mappedBy: Role의 'user' 필드가 주인임을 선언 (읽기 전용)
    private List<UserRole> userRoles = new ArrayList<>();
}

@Entity
public class UserRole {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    // @JoinColumn: 연관관계 주인 — user_id 외래키를 직접 관리
    private User user;
}
```

### FetchType

| 타입 | 동작 | 기본값 |
|---|---|---|
| `LAZY` | 실제 접근 시 쿼리 실행 | `@OneToMany`, `@ManyToMany` |
| `EAGER` | 즉시 JOIN으로 함께 로딩 | `@ManyToOne`, `@OneToOne` |

> **원칙:** 모든 연관관계는 `FetchType.LAZY`로 시작. 성능 문제 발생 시 `@EntityGraph`나 `fetch join`으로 최적화.

```java
// ❌ EAGER 기본값인 @ManyToOne을 그대로 사용 — N+1 쿼리 위험
@ManyToOne
@JoinColumn(name = "role_id")
private Role role;

// ✅ 명시적 LAZY 설정
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "role_id", nullable = false)
private Role role;
```

---

## @Column 제약조건

```java
@Column(
    name = "email",          // DB 컬럼명 (생략 시 필드명)
    nullable = false,        // NOT NULL 제약
    unique = true,           // UNIQUE 제약
    length = 255             // VARCHAR 길이 (문자열 기본값 255)
)
private String email;

@Column(
    precision = 19,          // 숫자 전체 자릿수
    scale = 4                // 소수점 자릿수
)
private BigDecimal price;
```

> `nullable = false`는 반드시 명시. 생략 시 DB에 NOT NULL 제약이 없어 데이터 정합성이 보장되지 않는다.

---

## @Query — 커스텀 쿼리

```java
public interface UserRepository extends JpaRepository<User, UUID> {

    // JPQL — 엔티티 기준
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.active = true")
    Optional<User> findActiveByEmail(@Param("email") String email);

    // Native SQL — 복잡한 쿼리 시
    @Query(value = "SELECT * FROM users WHERE created_at > :since", nativeQuery = true)
    List<User> findRecentUsers(@Param("since") LocalDateTime since);
}
```

> 문자열 직접 연결 절대 금지: `"... WHERE email = '" + email + "'"` → SQL Injection 취약점

---

## @EntityGraph — N+1 해결

```java
public interface UserRepository extends JpaRepository<User, UUID> {

    // User 조회 시 userRoles도 즉시 fetch join
    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findWithRolesById(@Param("id") UUID id);
}
```

---

## 영속성 컨텍스트 상태

| 상태 | 설명 | 변경 감지 |
|---|---|---|
| `MANAGED` | 영속성 컨텍스트에 등록된 상태 | O (dirty checking) |
| `DETACHED` | 트랜잭션 종료 후 분리된 상태 | X |
| `REMOVED` | 삭제 예약 상태 | — |
| `TRANSIENT` | `new`로 생성, 아직 저장 안 된 상태 | X |

> DETACHED 상태에서 연관관계를 접근하면 `LazyInitializationException` 발생. 트랜잭션 안에서 모든 연관 데이터 접근을 완료해야 한다.
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/03-jpa-repository-layer.md
git commit -m "docs: JPA Repository Layer 가이드 추가"
```

---

## Task 5: 04-security-auth.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/04-security-auth.md`

- [x] **Step 1: 파일 생성**

```markdown
# Security / Auth Layer

> JWT 기반 인증 + RBAC 권한 검증. terab은 `리소스:액션` 형식 권한 체계를 사용한다.

## 요약 테이블

| 어노테이션/설정 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@EnableWebSecurity` | ★★★ | Spring Security 활성화 | 클래스 | `SecurityConfig`에 1회만 |
| `@SecurityFilterChain` | ★★★ | 필터 체인 빈 등록 | 메서드 | — |
| `@EnableMethodSecurity` | ★★★ | 메서드 레벨 보안 활성화 | 클래스 | `@PreAuthorize` 사용 전제 조건 |
| `@PreAuthorize` | ★★★ | 메서드 레벨 권한 검증 (SpEL) | 메서드 | `@EnableMethodSecurity` 필요 |
| `@Secured` | ★★☆ | 역할 기반 접근 제어 (단순) | 메서드 | SpEL 불가, `@PreAuthorize` 권장 |
| `@AuthenticationPrincipal` | ★★★ | 현재 인증 사용자 주입 | 파라미터 | `UserDetails` 구현체 직접 수신 |
| `permitAll` / `authenticated` | ★★★ | URL 패턴별 접근 제어 | 설정 | 구체적 규칙 → 일반 규칙 순서 |

---

## SecurityFilterChain 기본 구성

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // @PreAuthorize 사용을 위해 필수
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                            JwtAuthenticationFilter jwtFilter) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)      // JWT 사용 시 CSRF 불필요
                .sessionManagement(s -> s
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()   // 인증 없이 접근
                        .requestMatchers("/api/shares/**").permitAll() // 공유 링크 접근
                        .anyRequest().authenticated())                  // 나머지는 인증 필요
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
```

> **URL 규칙 순서:** 구체적인 패턴(예: `/api/auth/**`)을 먼저 선언해야 한다.
> `anyRequest()`는 항상 마지막에 위치해야 한다.

---

## JWT 필터 체인 동작 원리

```
요청 → JwtAuthenticationFilter → SecurityContext에 Authentication 설정
                                → Controller (@AuthenticationPrincipal로 사용자 접근)
```

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtProvider.validateToken(token)) {
            String userId = jwtProvider.getUserId(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

---

## @PreAuthorize — RBAC 권한 검증

terab의 `리소스:액션` 권한 형식과 연동:

```java
@RestController
@RequestMapping("/api/files")
public class FileController {

    @PreAuthorize("hasAuthority('file:read')")
    @GetMapping("/{id}")
    public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) { ... }

    @PreAuthorize("hasAuthority('file:write')")
    @PostMapping
    public ResponseEntity<FileResponse> uploadFile(@RequestBody @Valid UploadFileRequest req) { ... }

    @PreAuthorize("hasAuthority('file:delete')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFile(@PathVariable UUID id) { ... }
}

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    @PreAuthorize("hasAuthority('user:manage')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateUser(@PathVariable UUID id) { ... }

    @PreAuthorize("hasAuthority('user:role')")
    @PostMapping("/{id}/roles")
    public ResponseEntity<Void> assignRole(@PathVariable UUID id,
                                           @RequestBody AssignRoleRequest request) { ... }
}
```

### SpEL 표현식 예시

```java
// 권한 OR 조건
@PreAuthorize("hasAuthority('file:write') or hasAuthority('share:manage')")

// 역할 기반 (terab은 권한 기반 권장)
@PreAuthorize("hasRole('ADMIN')")  // ROLE_ prefix 자동 추가

// 현재 사용자 조건
@PreAuthorize("#userId == authentication.principal.id")
public ResponseEntity<Void> deleteOwnAccount(@PathVariable UUID userId) { ... }
```

---

## @AuthenticationPrincipal

SecurityContext의 인증 사용자를 Controller 파라미터로 직접 주입:

```java
@GetMapping("/me")
public ResponseEntity<UserResponse> getMyProfile(
        @AuthenticationPrincipal CustomUserDetails userDetails) {
    return ResponseEntity.ok(userService.findById(userDetails.getId()));
}

@PostMapping
public ResponseEntity<FileResponse> uploadFile(
        @RequestBody @Valid UploadFileRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails) {
    request.setOwnerId(userDetails.getId());
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(fileService.upload(request));
}
```

> `CustomUserDetails`는 `UserDetails`를 구현한 terab 클래스. `getId()`, `getEmail()` 등 프로젝트 전용 메서드를 제공한다.

---

## CORS 설정

terab은 프론트엔드 컨테이너 내부 Nginx에서 `/api/**`를 백엔드로 프록시하므로 **CORS 불필요**. 직접 호출이 필요한 경우(테스트, 모바일):

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://drive.skypark207.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/04-security-auth.md
git commit -m "docs: Security Auth 가이드 추가"
```

---

## Task 6: 05-db-migration.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/05-db-migration.md`

- [x] **Step 1: 파일 생성**

```markdown
# DB Migration

> 스키마 변경은 항상 Flyway를 통해. `ddl-auto`는 운영에서 반드시 `none`.

## 요약 테이블

| 설정/규칙 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `ddl-auto=none` | ★★★ | 스키마 자동 변경 비활성화 (운영 필수) | application.yml | 운영 환경 기본값 |
| `ddl-auto=validate` | ★★☆ | 엔티티-DB 스키마 일치 검증 | application.yml | Flyway와 함께 사용 |
| `ddl-auto=update` | ★☆☆ | 자동 스키마 변경 (로컬 개발만) | application.yml | 운영 절대 금지 |
| `V{n}__{desc}.sql` | ★★★ | Flyway 마이그레이션 파일 규칙 | 파일명 | 실행 후 절대 수정 금지 |
| `R__{desc}.sql` | ★☆☆ | 반복 실행 마이그레이션 | 파일명 | 멱등성 보장 필수 |
| `baseline-on-migrate` | ★★☆ | 기존 DB에 Flyway 최초 도입 | application.yml | 초기 도입 시 1회만 |

---

## ddl-auto 옵션 상세

| 값 | 동작 | 권장 환경 |
|---|---|---|
| `none` | 아무것도 안 함 | **운영 (필수)** |
| `validate` | 엔티티 ↔ 스키마 불일치 시 앱 시작 실패 | 운영 (Flyway 있을 때) |
| `update` | 엔티티 변경에 맞게 스키마 자동 ALTER | 로컬 개발만 |
| `create` | 앱 시작 시 스키마 DROP 후 CREATE | 테스트 환경만 |
| `create-drop` | 앱 종료 시 스키마 DROP | 테스트 환경만 |

```yaml
# application-prod.yml — 운영 설정
spring:
  jpa:
    hibernate:
      ddl-auto: none  # Flyway가 스키마를 관리
  flyway:
    enabled: true
    locations: classpath:db/migration

# application-local.yml — 로컬 개발
spring:
  jpa:
    hibernate:
      ddl-auto: update  # 빠른 프로토타이핑용
  flyway:
    enabled: false
```

---

## Flyway

### 동작 원리

1. 앱 시작 시 `flyway_schema_history` 테이블에서 실행 이력 조회
2. `db/migration/` 디렉터리의 SQL 파일을 버전 순으로 스캔
3. 미실행 파일을 순서대로 실행하고 이력에 기록
4. 이미 실행된 파일의 내용이 변경되면 **checksum 오류**로 앱 시작 실패

### 파일 네이밍 규칙

```
V{버전}__{설명}.sql
│         │
│         └─ 언더스코어 2개 필수, 공백은 _로 대체
└─ 정수 또는 소수점 버전 (V1, V1.1, V2)

예시:
V1__init_schema.sql
V2__add_permissions_table.sql
V3__add_user_quota_column.sql
V1.1__add_index_to_users_email.sql
```

### 마이그레이션 파일 작성 원칙

```sql
-- V2__add_permissions_table.sql
-- ✅ 원칙 1: 한 파일에 하나의 논리적 변경
CREATE TABLE permissions (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    resource    VARCHAR(50) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX idx_permissions_resource_action ON permissions (resource, action);
```

```sql
-- ❌ 원칙 2 위반: 스키마 변경과 데이터 변환 혼합
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;
UPDATE users SET quota_bytes = 10737418240;  -- 혼합 시 롤백 복잡

-- ✅ 분리
-- V3__add_quota_column.sql: ALTER만
-- V4__set_default_quota.sql: UPDATE만
```

```sql
-- ✅ 원칙 3: 롤백 불가를 염두에 둔 안전한 변경
-- 컬럼 추가: DEFAULT 값 또는 nullable 허용
ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT DEFAULT 10737418240;

-- ❌ 위험: 기존 데이터가 있는 컬럼에 NOT NULL 즉시 추가
ALTER TABLE users ADD COLUMN new_required_field VARCHAR(100) NOT NULL;
-- 해결: 1) nullable로 추가 → 2) 데이터 채우기 → 3) NOT NULL 추가 (3단계 마이그레이션)
```

### Flyway vs Liquibase

| 항목 | Flyway | Liquibase |
|---|---|---|
| 문법 | SQL / Java | XML / YAML / JSON / SQL |
| 학습 곡선 | 낮음 | 높음 |
| 롤백 | 유료 기능 (Community 불가) | XML 기반 롤백 지원 |
| 적합한 경우 | SQL 직접 작성 선호, 단순한 마이그레이션 | 복잡한 멀티 DB, 롤백 필수 |

> terab 권장: **Flyway** — SQL을 그대로 사용하고, 롤백 대신 Forward Migration 전략으로 운영.

### Flyway 의존성 (build.gradle)

```groovy
dependencies {
    implementation 'org.flywaydb:flyway-core'
    implementation 'org.flywaydb:flyway-database-postgresql'
}
```
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/05-db-migration.md
git commit -m "docs: DB Migration 가이드 추가"
```

---

## Task 7: 06-quick-reference.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/06-quick-reference.md`

- [x] **Step 1: 파일 생성**

```markdown
# Quick Reference — 카테고리별 어노테이션 색인

> 어노테이션 이름을 알지만 어느 레이어에 있는지 모를 때 사용.

## 요청 매핑

| 어노테이션 | 설명 | 상세 문서 |
|---|---|---|
| `@RestController` | HTTP 응답 자동 JSON 직렬화 | [01-controller-layer.md](./01-controller-layer.md#restcontroller) |
| `@RequestMapping` | URL + HTTP 메서드 매핑 (공통 prefix) | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |
| `@GetMapping` | GET 요청 매핑 | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |
| `@PostMapping` | POST 요청 매핑 | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |
| `@PutMapping` | PUT 요청 매핑 | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |
| `@PatchMapping` | PATCH 요청 매핑 | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |
| `@DeleteMapping` | DELETE 요청 매핑 | [01-controller-layer.md](./01-controller-layer.md#http-메서드-매핑) |

## 요청 바인딩

| 어노테이션 | 설명 | 상세 문서 |
|---|---|---|
| `@PathVariable` | URL 경로 변수 바인딩 | [01-controller-layer.md](./01-controller-layer.md#pathvariable) |
| `@RequestParam` | 쿼리스트링 바인딩 | [01-controller-layer.md](./01-controller-layer.md#requestparam) |
| `@RequestBody` | JSON 요청 바디 → 객체 역직렬화 | [01-controller-layer.md](./01-controller-layer.md#requestbody) |
| `@RequestHeader` | HTTP 헤더 값 바인딩 | [01-controller-layer.md](./01-controller-layer.md) |
| `@Valid` | Bean Validation 트리거 | [01-controller-layer.md](./01-controller-layer.md#requestbody) |

## 응답 제어

| 어노테이션/타입 | 설명 | 상세 문서 |
|---|---|---|
| `ResponseEntity<T>` | 상태코드 + 헤더 + 바디 제어 | [01-controller-layer.md](./01-controller-layer.md#responseentityt) |
| `@ResponseStatus` | 고정 HTTP 상태코드 | [01-controller-layer.md](./01-controller-layer.md#responsestatus-vs-responseentity) |
| `@RestControllerAdvice` | 전역 예외 처리기 | [01-controller-layer.md](./01-controller-layer.md#예외-처리) |
| `@ExceptionHandler` | 특정 예외 처리 메서드 | [01-controller-layer.md](./01-controller-layer.md#예외-처리) |

## 트랜잭션

| 어노테이션/속성 | 설명 | 상세 문서 |
|---|---|---|
| `@Transactional` | 트랜잭션 경계 설정 | [02-service-layer.md](./02-service-layer.md#transactional) |
| `@Transactional(readOnly=true)` | 조회 전용 최적화 | [02-service-layer.md](./02-service-layer.md#readonlytrue-효과) |
| `Propagation.REQUIRED` | 기존 트랜잭션 참여 (기본값) | [02-service-layer.md](./02-service-layer.md#propagation-전파-레벨) |
| `Propagation.REQUIRES_NEW` | 독립 트랜잭션 강제 생성 | [02-service-layer.md](./02-service-layer.md#propagation-전파-레벨) |
| `rollbackFor` | 롤백 대상 예외 명시 | [02-service-layer.md](./02-service-layer.md#rollbackfor) |
| `@Async` | 비동기 실행 | [02-service-layer.md](./02-service-layer.md#async) |

## JPA / 엔티티

| 어노테이션 | 설명 | 상세 문서 |
|---|---|---|
| `@Entity` | JPA 엔티티 등록 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#엔티티-기본-패턴-terab-스타일) |
| `@Table` | 테이블명/인덱스 명시 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#column-제약조건) |
| `@Id` | PK 지정 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#generatedvalue-전략) |
| `@GeneratedValue` | PK 자동생성 전략 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#generatedvalue-전략) |
| `@Column` | 컬럼 제약조건 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#column-제약조건) |
| `@OneToMany` | 1:N 관계 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#연관관계-매핑) |
| `@ManyToOne` | N:1 관계 (연관관계 주인) | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#연관관계-매핑) |
| `@Query` | 커스텀 JPQL | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#query--커스텀-쿼리) |
| `@EntityGraph` | N+1 해결 | [03-jpa-repository-layer.md](./03-jpa-repository-layer.md#entitygraph--n1-해결) |

## 보안

| 어노테이션/설정 | 설명 | 상세 문서 |
|---|---|---|
| `@EnableWebSecurity` | Spring Security 활성화 | [04-security-auth.md](./04-security-auth.md#securityfilterchain-기본-구성) |
| `@EnableMethodSecurity` | 메서드 레벨 보안 활성화 | [04-security-auth.md](./04-security-auth.md#securityfilterchain-기본-구성) |
| `@PreAuthorize` | SpEL 기반 권한 검증 | [04-security-auth.md](./04-security-auth.md#preauthorize--rbac-권한-검증) |
| `@AuthenticationPrincipal` | 현재 인증 사용자 주입 | [04-security-auth.md](./04-security-auth.md#authenticationprincipal) |

## DB 마이그레이션

| 설정/규칙 | 설명 | 상세 문서 |
|---|---|---|
| `ddl-auto=none` | 스키마 자동 변경 비활성화 | [05-db-migration.md](./05-db-migration.md#ddl-auto-옵션-상세) |
| `V{n}__{desc}.sql` | Flyway 마이그레이션 파일 규칙 | [05-db-migration.md](./05-db-migration.md#파일-네이밍-규칙) |
| `baseline-on-migrate` | 기존 DB Flyway 도입 | [05-db-migration.md](./05-db-migration.md#flyway) |
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/06-quick-reference.md
git commit -m "docs: Quick Reference 색인 파일 추가"
```

---

## Task 8: anti-patterns/README.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/README.md`

- [x] **Step 1: 파일 생성**

```markdown
# 안티패턴 가이드

> Spring Boot REST API 개발에서 절대 사용하면 안 되는 패턴 29가지.
> 위험도: 🔴 데이터 손실 | 🟠 보안 취약점 | 🟡 성능 저하 | 🔵 유지보수 문제

## 전체 목록

| # | 패턴 | 카테고리 | 위험도 | 파일 |
|---|------|----------|--------|------|
| AP-01 | Controller에서 `@Transactional` 사용 | Controller | 🔵 | [01-controller.md](./01-controller.md) |
| AP-02 | Controller에서 비즈니스 로직 직접 구현 | Controller | 🔵 | [01-controller.md](./01-controller.md) |
| AP-03 | `@RequestBody`에 Entity 직접 바인딩 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-04 | 응답에 Entity 직접 반환 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-05 | `@PathVariable`로 내부 순차 DB ID 노출 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-06 | `@Transactional` self-invocation | Service | 🔵 | [02-service.md](./02-service.md) |
| AP-07 | `@Transactional(readOnly=true)` 미사용 | Service | 🟡 | [02-service.md](./02-service.md) |
| AP-08 | Service에서 `HttpServletRequest` 직접 참조 | Service | 🔵 | [02-service.md](./02-service.md) |
| AP-09 | CheckedException `rollbackFor` 미설정 | Service | 🔴 | [02-service.md](./02-service.md) |
| AP-10 | `@Entity`에 Lombok `@Data` 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-11 | `@ManyToMany` 중간 엔티티 없이 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-12 | N+1 쿼리 (Lazy 로딩 + 반복 접근) | JPA | 🟡 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-13 | 영속성 컨텍스트 밖 Lazy 로딩 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-14 | `Optional.get()` 직접 호출 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-15 | 양방향 연관관계에서 `@ToString` 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-16 | `@Column(nullable=false)` 미설정 | JPA | 🔴 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-17 | `ddl-auto=update` 운영 사용 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-18 | `ddl-auto=create`/`create-drop` 운영 사용 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-19 | Flyway 없이 DB 직접 수정 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-20 | 실행된 Flyway 파일 수정 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-21 | 마이그레이션에서 스키마 변경 + 데이터 변환 혼합 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-22 | 빈 catch 블록 (예외 삼킴) | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-23 | `Exception` 전체 catch | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-24 | HTTP 200에 에러 응답 반환 | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-25 | `@RestControllerAdvice` 없이 예외 분산 처리 | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-26 | 응답에 민감 필드 포함 (password 등) | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-27 | JPQL에 문자열 직접 연결 | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-28 | 권한 검증을 프론트엔드에만 의존 | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-29 | JWT Secret 코드 하드코딩 | 보안 | 🟠 | [06-security.md](./06-security.md) |
```

- [x] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/README.md
git commit -m "docs: 안티패턴 가이드 목차 추가"
```

---

## Task 9: anti-patterns/01-controller.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/01-controller.md`

- [ ] **Step 1: 파일 생성**

```markdown
# 안티패턴 — Controller Layer

[← 목차로 돌아가기](./README.md)

---

## AP-01: Controller에서 `@Transactional` 사용

**위험도:** 🔵 유지보수 문제

**왜 문제인가:**
Spring Security 필터, 인터셉터, 파라미터 바인딩 등 HTTP 처리 과정 전체가 트랜잭션 안에 포함된다.
트랜잭션이 열려 있는 시간이 길어져 DB 커넥션 점유 시간이 늘어나고 커넥션 풀이 고갈될 수 있다.
또한 Controller는 테스트하기 어려운 레이어인데 트랜잭션까지 걸리면 단위 테스트가 불가능해진다.

```java
// ❌
@RestController
@Transactional  // Controller에 트랜잭션 — 금지
public class FileController {
    @GetMapping("/{id}")
    public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) {
        return ResponseEntity.ok(fileService.findById(id));
    }
}

// ✅
@RestController
public class FileController {
    @GetMapping("/{id}")
    public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) {
        return ResponseEntity.ok(fileService.findById(id));
        // 트랜잭션은 fileService 안에서 관리
    }
}
```

---

## AP-02: Controller에서 비즈니스 로직 직접 구현

**위험도:** 🔵 유지보수 문제

**왜 문제인가:**
Controller는 HTTP 요청을 받아 Service에 위임하고 응답을 반환하는 역할만 한다.
비즈니스 로직이 Controller에 있으면 재사용이 불가능하고, 다른 진입점(스케줄러, 이벤트 리스너)에서 같은 로직을 쓸 수 없다.

```java
// ❌
@PostMapping("/login")
public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    // 비즈니스 로직이 Controller에
    User user = userRepository.findByEmail(request.email())
        .orElseThrow(() -> new RuntimeException("사용자 없음"));
    if (!passwordEncoder.matches(request.password(), user.getPassword())) {
        throw new RuntimeException("비밀번호 불일치");
    }
    String token = jwtProvider.generateToken(user.getId().toString());
    return ResponseEntity.ok(new LoginResponse(token));
}

// ✅
@PostMapping("/login")
public ResponseEntity<LoginResponse> login(@RequestBody @Valid LoginRequest request) {
    return ResponseEntity.ok(authService.login(request));
    // 비즈니스 로직은 AuthService에 위임
}
```

---

## AP-03: `@RequestBody`에 Entity 직접 바인딩

**위험도:** 🟠 보안 취약점 (Mass Assignment)

**왜 문제인가:**
클라이언트가 JSON에 임의의 필드(예: `"id"`, `"role"`, `"admin": true`)를 포함해 보내면
Entity의 해당 필드가 덮어써진다. Setter가 없더라도 Jackson은 리플렉션으로 필드를 직접 설정할 수 있다.
또한 Entity 구조가 API 스펙에 노출되어 스키마 변경이 곧 API 변경이 된다.

```java
// ❌
@PostMapping("/users")
public ResponseEntity<User> createUser(@RequestBody User user) {
    // 클라이언트가 {"email": "...", "role": "ADMIN"} 전송 가능
    return ResponseEntity.ok(userRepository.save(user));
}

// ✅
@PostMapping("/users")
public ResponseEntity<UserResponse> createUser(@RequestBody @Valid CreateUserRequest request) {
    // CreateUserRequest는 email, password 필드만 존재
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(userService.create(request));
}
```

---

## AP-04: 응답에 Entity 직접 반환

**위험도:** 🟠 보안 취약점 + 🔵 유지보수 문제

**왜 문제인가:**
1. **민감 정보 노출:** `password`, `refreshToken`, 내부 ID 등이 JSON에 포함됨
2. **순환 참조:** 양방향 연관관계(`@OneToMany` ↔ `@ManyToOne`)가 있으면 JSON 직렬화 중 무한루프 → `StackOverflowError`
3. **API-DB 결합:** DB 스키마 변경이 즉시 API 응답 변경으로 이어짐

```java
// ❌
@GetMapping("/{id}")
public ResponseEntity<User> getUser(@PathVariable UUID id) {
    return ResponseEntity.ok(userRepository.findById(id).orElseThrow());
    // password 필드, 연관 엔티티 전체가 응답에 포함됨
}

// ✅
@GetMapping("/{id}")
public ResponseEntity<UserResponse> getUser(@PathVariable UUID id) {
    return ResponseEntity.ok(userService.findById(id));
    // UserResponse는 필요한 필드만 포함한 DTO
}
```

---

## AP-05: `@PathVariable`로 내부 순차 DB ID 노출

**위험도:** 🟠 보안 취약점 (IDOR — Insecure Direct Object Reference)

**왜 문제인가:**
`/api/files/1`, `/api/files/2`, `/api/files/3`처럼 순차 ID를 URL에 노출하면
공격자가 권한 없는 다른 사용자의 리소스를 순서대로 탐색할 수 있다.
권한 검증이 있더라도 존재 여부 자체가 유출된다.

```java
// ❌ — Long ID 노출
@GetMapping("/{id}")
public ResponseEntity<FileResponse> getFile(@PathVariable Long id) {
    // GET /api/files/1, /api/files/2 ... 순차 탐색 가능
}

// ✅ — UUID 사용 (terab 표준)
@GetMapping("/{id}")
public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) {
    // GET /api/files/550e8400-e29b-41d4-a716-446655440000
    // 예측 불가능, 순차 탐색 불가
}
```
```

- [ ] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/01-controller.md
git commit -m "docs: Controller 안티패턴 가이드 추가 (AP-01~05)"
```

---

## Task 10: anti-patterns/02-service.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/02-service.md`

- [ ] **Step 1: 파일 생성**

```markdown
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

    private final NotificationSender notificationSender;  // 별도 빈

    @Transactional
    public void processAndNotify(UUID fileId) {
        process(fileId);
        notificationSender.sendNotification(fileId);  // 프록시를 통한 호출
    }
}

@Service
public class NotificationSender {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendNotification(UUID fileId) { ... }
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
public class FileService {
    public FileResponse findById(UUID id) {
        // @Transactional 없음 또는 readOnly 미설정 — dirty checking 수행
        File file = fileRepository.findById(id).orElseThrow(...);
        return FileResponse.from(file);
    }
}

// ✅
@Service
@Transactional(readOnly = true)  // 클래스 기본값: 모든 메서드 readOnly
public class FileService {

    public FileResponse findById(UUID id) {
        // dirty checking 생략
        File file = fileRepository.findById(id).orElseThrow(...);
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
        // ...
    }
}

// ✅ — Controller에서 필요한 값을 추출해 DTO로 전달
@RestController
public class AuthController {
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
```

- [ ] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/02-service.md
git commit -m "docs: Service 안티패턴 가이드 추가 (AP-06~09)"
```

---

## Task 11: anti-patterns/03-jpa-repository.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/03-jpa-repository.md`

- [ ] **Step 1: 파일 생성**

```markdown
# 안티패턴 — JPA / Repository Layer

[← 목차로 돌아가기](./README.md)

---

## AP-10: `@Entity`에 Lombok `@Data` 사용

**위험도:** 🔵 유지보수 문제 (런타임 오류 가능)

**왜 문제인가:**
`@Data`는 `@ToString` + `@EqualsAndHashCode` + `@Getter` + `@Setter` + `@RequiredArgsConstructor`를 포함한다.
- `@ToString`: 연관 엔티티를 포함해 직렬화 → 양방향 관계 시 **무한 순환 참조** → `StackOverflowError`
- `@EqualsAndHashCode`: PK 기반 equals/hashCode 미보장 → 컬렉션에서 동일 엔티티 중복 처리
- `@Setter`: 불변성 파괴 → 엔티티 상태를 아무 곳에서나 변경 가능

```java
// ❌
@Entity
@Data  // 위험
public class User {
    @OneToMany(mappedBy = "user")
    private List<UserRole> userRoles;  // @ToString이 UserRole → User → UserRole... 무한루프
}

// ✅ terab 패턴
@Entity
@Table(name = "users")
@Getter                                            // 읽기만 허용
@NoArgsConstructor(access = AccessLevel.PROTECTED) // JPA용 기본 생성자
@Builder
@AllArgsConstructor
public class User {
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    @ToString.Exclude  // 필요 시 @ToString 명시적 제외
    private List<UserRole> userRoles = new ArrayList<>();
}
```

---

## AP-11: `@ManyToMany` 중간 엔티티 없이 사용

**위험도:** 🔵 유지보수 문제

**왜 문제인가:**
`@ManyToMany`는 JPA가 중간 테이블을 자동 관리한다. 관계에 추가 컬럼(예: `assignedAt`, `assignedBy`)을
나중에 추가할 수 없다. 또한 관계 삭제 시 연결된 모든 행을 DELETE 후 다시 INSERT하는 비효율이 발생한다.

```java
// ❌
@Entity
public class User {
    @ManyToMany
    @JoinTable(name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private List<Role> roles;
    // 나중에 assignedAt 컬럼 추가 불가
}

// ✅ 중간 엔티티 사용
@Entity
@Table(name = "user_roles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(nullable = false)
    private LocalDateTime assignedAt;  // 나중에 추가 가능
}
```

---

## AP-12: N+1 쿼리

**위험도:** 🟡 성능 저하 (심각한 경우 서비스 장애)

**왜 문제인가:**
1개의 메인 쿼리 + N개의 연관 데이터 쿼리 = N+1 쿼리가 발생한다.
100명의 사용자를 조회하면서 각 사용자의 역할을 Lazy 로딩하면 101번의 쿼리가 실행된다.

```java
// ❌ N+1 발생
@Transactional(readOnly = true)
public List<UserResponse> findAllUsers() {
    List<User> users = userRepository.findAll();  // 쿼리 1번
    return users.stream()
        .map(user -> {
            List<String> roles = user.getUserRoles()  // 각 User마다 쿼리 1번 → N번
                .stream()
                .map(ur -> ur.getRole().getName())
                .toList();
            return UserResponse.of(user, roles);
        })
        .toList();
}

// ✅ @EntityGraph로 해결
public interface UserRepository extends JpaRepository<User, UUID> {
    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    List<User> findAll();  // JOIN FETCH로 한 번에 조회
}
```

---

## AP-13: 영속성 컨텍스트 밖 Lazy 로딩

**위험도:** 🔵 런타임 오류 (`LazyInitializationException`)

**왜 문제인가:**
`@Transactional` 메서드가 종료되면 영속성 컨텍스트가 닫힌다.
이후 DETACHED 상태의 엔티티에서 Lazy 로딩을 시도하면 `LazyInitializationException`이 발생한다.

```java
// ❌
@Transactional(readOnly = true)
public User findById(UUID id) {
    return userRepository.findById(id).orElseThrow(...);
    // userRoles는 아직 로딩 안 됨
}

// Controller에서
User user = userService.findById(id);
user.getUserRoles();  // LazyInitializationException — 트랜잭션 종료 후 접근
// Controller에서:
// user.getUserRoles().size();  // ❌ 트랜잭션 종료 후 Lazy 접근

// ✅ 트랜잭션 안에서 필요한 데이터를 DTO로 변환해 반환
@Transactional(readOnly = true)
public UserResponse findById(UUID id) {
    User user = userRepository.findWithRolesById(id).orElseThrow(...);
    return UserResponse.from(user);  // 트랜잭션 안에서 변환 완료
}
```

---

## AP-14: `Optional.get()` 직접 호출

**위험도:** 🔵 런타임 오류 (`NoSuchElementException`)

**왜 문제인가:**
`Optional.get()`은 값이 없으면 `NoSuchElementException`을 던진다.
`isPresent()` 체크 없이 호출하거나, 체크하더라도 의미 없는 패턴이 된다.

```java
// ❌
User user = userRepository.findById(id).get();
// 없으면 NoSuchElementException — 스택 트레이스만 있고 의미 없는 오류

// ❌ — isPresent() + get() 조합도 피해야 함
Optional<User> opt = userRepository.findById(id);
if (opt.isPresent()) {
    User user = opt.get();  // 이 패턴은 Optional 취지 무시
}

// ✅ — orElseThrow로 의미 있는 예외 발생
User user = userRepository.findById(id)
    .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

// ✅ — orElse로 기본값 처리
User user = userRepository.findById(id)
    .orElse(User.guest());
```

---

## AP-15: 양방향 연관관계에서 `@ToString` 사용

**위험도:** 🔵 런타임 오류 (`StackOverflowError`)

**왜 문제인가:**
`User.toString()` → `UserRole.toString()` → `User.toString()` → ... 무한 재귀 호출.
Lombok `@Data` 또는 `@ToString` 사용 시 자동으로 모든 필드를 포함한다.

```java
// ❌
@Entity
@ToString  // userRoles 포함
public class User {
    @OneToMany(mappedBy = "user")
    private List<UserRole> userRoles;
}

@Entity
@ToString  // user 포함
public class UserRole {
    @ManyToOne
    private User user;  // User.toString() → UserRole.toString() → 무한루프
}

// ✅
@Entity
@ToString(exclude = "userRoles")  // 연관관계 필드 제외
public class User {
    @OneToMany(mappedBy = "user")
    private List<UserRole> userRoles;
}
```

---

## AP-16: `@Column(nullable=false)` 미설정

**위험도:** 🔴 데이터 정합성 문제

**왜 문제인가:**
`nullable=false`를 생략하면 JPA가 DDL을 생성할 때 NOT NULL 제약을 추가하지 않는다.
(Flyway 사용 시에는 직접 SQL에 NOT NULL을 써야 하므로 더욱 주의 필요)
애플리케이션 레벨에서 `@NotNull` 검증이 있어도 DB 직접 접근이나 마이그레이션 스크립트에서 NULL이 삽입될 수 있다.

```java
// ❌
@Column
private String email;  // DB에 NULL 허용 — 데이터 정합성 미보장

// ✅
@Column(nullable = false, length = 255)
private String email;  // DB NOT NULL 제약 + 길이 제한
```
```

- [ ] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/03-jpa-repository.md
git commit -m "docs: JPA Repository 안티패턴 가이드 추가 (AP-10~16)"
```

---

## Task 12: anti-patterns/04-db-migration.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/04-db-migration.md`

- [ ] **Step 1: 파일 생성**

```markdown
# 안티패턴 — DB Migration

[← 목차로 돌아가기](./README.md)

---

## AP-17: `ddl-auto=update` 운영 사용

**위험도:** 🔴 데이터 손실 가능

**왜 문제인가:**
`update`는 엔티티에 없는 컬럼을 자동으로 삭제하지 않는다(추가만 함).
하지만 컬럼 이름 변경, 타입 변경 시 기존 컬럼을 삭제하고 새 컬럼을 추가하는 방식으로 동작해
데이터가 손실될 수 있다. 또한 동시 배포(롤링 업데이트) 시 구버전과 신버전 간 스키마 충돌이 발생한다.

```yaml
# ❌ 운영 환경
spring:
  jpa:
    hibernate:
      ddl-auto: update

# ✅ 운영 환경
spring:
  jpa:
    hibernate:
      ddl-auto: none  # 스키마는 Flyway가 관리
  flyway:
    enabled: true
```

---

## AP-18: `ddl-auto=create` / `create-drop` 운영 사용

**위험도:** 🔴 데이터 전체 삭제

**왜 문제인가:**
- `create`: 앱 시작 시 기존 테이블을 DROP하고 다시 CREATE → **모든 데이터 삭제**
- `create-drop`: 앱 종료 시 테이블 DROP → 재시작 시 데이터 없음

```yaml
# ❌ 절대 금지 (운영)
spring:
  jpa:
    hibernate:
      ddl-auto: create        # 시작 시 전체 데이터 삭제
      # 또는
      ddl-auto: create-drop   # 종료 시 전체 데이터 삭제
```

> 테스트 환경에서만 사용. `@SpringBootTest`와 H2 인메모리 DB 조합에서 허용.

---

## AP-19: Flyway 없이 DB 직접 수정

**위험도:** 🔴 환경 불일치

**왜 문제인가:**
DBeaver, psql 등으로 운영 DB를 직접 수정하면:
1. 개발/스테이징/운영 환경 간 스키마가 달라짐
2. 변경 이력이 없어 롤백 불가
3. 팀원 로컬 환경 재현 불가 → "내 로컬에서는 됩니다" 문제 발생

```
# ❌ DBeaver/psql로 직접:
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

# ✅ Flyway 마이그레이션 파일로:
# V5__add_last_login_to_users.sql
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
# → git에 기록, 모든 환경에 자동 적용
```

---

## AP-20: 실행된 Flyway 파일 수정

**위험도:** 🔴 앱 시작 실패

**왜 문제인가:**
Flyway는 실행된 파일의 checksum을 `flyway_schema_history` 테이블에 저장한다.
파일을 수정하면 저장된 checksum과 불일치 → 앱 시작 시 예외 발생.

```
ERROR: Validate failed: 
Migration checksum mismatch for migration version 2
-> Applied to database : 1234567890
-> Resolved locally    : 9876543210
```

```
# ❌ 실행된 파일 수정
# V2__add_permissions_table.sql 을 편집

# ✅ 새 마이그레이션 파일로 수정
# V3__fix_permissions_table.sql
ALTER TABLE permissions ADD COLUMN description VARCHAR(200);
```

---

## AP-21: 마이그레이션에서 스키마 변경 + 데이터 변환 혼합

**위험도:** 🔴 부분 실패 시 복구 불가

**왜 문제인가:**
하나의 파일에서 DDL과 DML을 함께 실행하면 중간 실패 시 어디까지 반영됐는지 파악이 어렵다.
PostgreSQL은 DDL도 트랜잭션이 지원되지만, 대용량 데이터 업데이트 + DDL 혼합은 Lock 경합과 타임아웃을 유발한다.

```sql
-- ❌ V4__quota_feature.sql — DDL + DML 혼합
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;
UPDATE users SET quota_bytes = 10737418240 WHERE quota_bytes IS NULL;
ALTER TABLE users ALTER COLUMN quota_bytes SET NOT NULL;

-- ✅ 분리
-- V4__add_quota_column.sql
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;

-- V5__set_default_quota.sql
UPDATE users SET quota_bytes = 10737418240 WHERE quota_bytes IS NULL;

-- V6__quota_column_not_null.sql
ALTER TABLE users ALTER COLUMN quota_bytes SET NOT NULL;
```
```

- [ ] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/04-db-migration.md
git commit -m "docs: DB Migration 안티패턴 가이드 추가 (AP-17~21)"
```

---

## Task 13: anti-patterns/05-exception-handling.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/05-exception-handling.md`

- [ ] **Step 1: 파일 생성**

```markdown
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
try {
    return userRepository.findById(id)
        .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
} catch (DataAccessException e) {
    log.error("DB 접근 오류: {}", e.getMessage(), e);
    throw new ApiException(ErrorCode.DB_ERROR);
}
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
```

- [ ] **Step 2: 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/05-exception-handling.md
git commit -m "docs: 예외처리 안티패턴 가이드 추가 (AP-22~25)"
```

---

## Task 14: anti-patterns/06-security.md

**Files:**
- Create: `docs/guides/spring-boot-rest-api/anti-patterns/06-security.md`

- [ ] **Step 1: 파일 생성**

```markdown
# 안티패턴 — 보안

[← 목차로 돌아가기](./README.md)

---

## AP-26: 응답에 민감 필드 포함 (password 등)

**위험도:** 🟠 보안 취약점 (정보 유출)

**왜 문제인가:**
Entity를 직접 반환하거나 DTO에 민감 필드를 포함하면 해시된 비밀번호, 내부 토큰, 개인정보가 API 응답에 노출된다.
로그, 브라우저 히스토리, 프록시 서버에 기록될 수 있다.

```java
// ❌ Entity 직접 반환 — password 필드 포함
@GetMapping("/me")
public ResponseEntity<User> getMyProfile(@AuthenticationPrincipal CustomUserDetails details) {
    return ResponseEntity.ok(userRepository.findById(details.getId()).orElseThrow());
    // { "id": "...", "email": "...", "password": "$2a$10$...", "refreshToken": "..." }
}

// ✅ DTO 사용 — 필요한 필드만
public record UserResponse(
    UUID id,
    String email,
    String username,
    List<String> roles
    // password, refreshToken 미포함
) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getEmail(),
            user.getUsername(),
            user.getUserRoles().stream()
                .map(ur -> ur.getRole().getName())
                .toList()
        );
    }
}
```

---

## AP-27: JPQL에 문자열 직접 연결 (SQL Injection)

**위험도:** 🟠 보안 취약점 (SQL Injection)

**왜 문제인가:**
문자열 연결로 쿼리를 구성하면 사용자 입력이 SQL 구문으로 해석된다.
JPQL도 동일하다. 파라미터 바인딩(`:param` 또는 `?1`)을 사용해야 PreparedStatement로 처리된다.

```java
// ❌ SQL Injection 취약
@Query("SELECT u FROM User u WHERE u.email = '" + "' + email + '" + "'")
// 실제 코드에서:
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    // ❌ 네이티브 쿼리에서 문자열 연결
    @Query(value = "SELECT * FROM users WHERE email = '" + "#{#email}" + "'", nativeQuery = true)
    List<User> findByEmailUnsafe(String email);
}

// ✅ 파라미터 바인딩 사용
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// ✅ Spring Data JPA 메서드 명명 (자동 바인딩)
Optional<User> findByEmailAndActiveTrue(String email);
```

---

## AP-28: 권한 검증을 프론트엔드에만 의존

**위험도:** 🟠 보안 취약점 (인가 우회)

**왜 문제인가:**
프론트엔드의 버튼 숨김, 메뉴 비활성화는 UI 경험을 위한 것이지 보안이 아니다.
`curl`, Postman 등으로 API를 직접 호출하면 프론트엔드 제한을 모두 우회할 수 있다.
**모든 권한 검증은 반드시 서버(API)에서 수행해야 한다.**

```java
// ❌ API에 권한 검증 없음 — 프론트에서만 관리자 버튼 숨김
@DeleteMapping("/admin/users/{id}")
public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
    userService.delete(id);  // 누구나 호출 가능
    return ResponseEntity.noContent().build();
}

// ✅ API에서 권한 검증 (terab RBAC 패턴)
@PreAuthorize("hasAuthority('user:manage')")
@DeleteMapping("/admin/users/{id}")
public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
    userService.delete(id);
    return ResponseEntity.noContent().build();
}
```

---

## AP-29: JWT Secret 코드 하드코딩

**위험도:** 🟠 보안 취약점 (전체 토큰 위조 가능)

**왜 문제인가:**
JWT Secret이 소스코드에 있으면 GitHub 등 코드 저장소에 노출된다.
Secret이 유출되면 공격자가 임의의 JWT를 서명해 관리자 권한을 획득할 수 있다.

```java
// ❌
@Component
public class JwtProvider {
    private final String secret = "mySecretKey12345";  // 코드에 하드코딩
}

// ✅ 환경변수 또는 Docker Secret 사용
@Component
public class JwtProvider {

    @Value("${jwt.secret}")  // application.yml에서 읽기
    private String secret;
}
```

```yaml
# ✅ application.yml — 실제 값은 환경변수로 주입
jwt:
  secret: ${JWT_SECRET}  # Docker Secret 또는 시스템 환경변수

# terab Docker Swarm 배포 시:
# docker secret create jwt_secret <(echo "실제시크릿값")
# docker service update --secret-add jwt_secret api
```
```

- [ ] **Step 2: 최종 커밋**

```bash
git add docs/guides/spring-boot-rest-api/anti-patterns/06-security.md
git commit -m "docs: 보안 안티패턴 가이드 추가 (AP-26~29)"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 구현 Task |
|---|---|
| 레이어별 가이드 (01~05) | Task 2~6 |
| 각 파일 상단 요약 테이블 | Task 2~6 (각 파일 상단) |
| 어노테이션 내부 동작 원리 | Task 2~6 본문 |
| terab 프로젝트 스타일 코드 예시 | Task 2~6 모든 코드 예시 |
| Quick Reference 색인 (B타입) | Task 7 |
| 안티패턴 가이드 분리 파일 | Task 9~14 |
| 29개 안티패턴 전체 목록 | Task 8 (README) |
| DB 마이그레이션 관련 내용 | Task 6 (05-db-migration), Task 12 (AP-17~21) |
| 안티패턴 목차 파일 | Task 8 |
| 전체 목차 (README.md) | Task 1 |

모든 스펙 요구사항이 커버됨. Placeholder 없음. 타입/메서드명 일관성 확인됨.

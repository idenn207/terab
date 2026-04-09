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

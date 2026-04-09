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

@GetMapping("/me")
public ResponseEntity<UserResponse> getMyProfile(@AuthenticationPrincipal CustomUserDetails details) {
    return ResponseEntity.ok(userService.findById(details.getId()));
}
```

---

## AP-27: JPQL에 문자열 직접 연결 (SQL Injection)

**위험도:** 🟠 보안 취약점 (SQL Injection)

**왜 문제인가:**
문자열 연결로 쿼리를 구성하면 사용자 입력이 SQL 구문으로 해석된다.
JPQL도 동일하다. 파라미터 바인딩(`:param` 또는 `?1`)을 사용해야 PreparedStatement로 처리된다.

```java
// ❌ 네이티브 쿼리에서 문자열 연결 — SQL Injection 취약
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    @Query(value = "SELECT * FROM users WHERE email = '" + "#{#email}" + "'", nativeQuery = true)
    List<User> findByEmailUnsafe(@Param("email") String email);
    // 입력: "' OR '1'='1" → 전체 사용자 조회 가능
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

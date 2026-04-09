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
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

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
    return userRepository.findById(id).orElseThrow(
        () -> new ApiException(ErrorCode.USER_NOT_FOUND)
    );
    // userRoles는 아직 로딩 안 됨 — 트랜잭션 종료 후 DETACHED
}

// Controller에서:
// user.getUserRoles().size();  // ❌ LazyInitializationException — 트랜잭션 종료 후 접근

// ✅ 트랜잭션 안에서 필요한 데이터를 DTO로 변환해 반환
@Transactional(readOnly = true)
public UserResponse findById(UUID id) {
    User user = userRepository.findWithRolesById(id).orElseThrow(
        () -> new ApiException(ErrorCode.USER_NOT_FOUND)
    );
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

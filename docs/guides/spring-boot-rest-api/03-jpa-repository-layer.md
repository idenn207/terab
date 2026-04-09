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

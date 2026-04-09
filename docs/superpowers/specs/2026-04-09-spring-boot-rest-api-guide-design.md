# Spring Boot REST API 가이드 문서 설계

**날짜:** 2026-04-09
**목적:** 개인 참고용 치트시트 — 어노테이션 설명 + terab 프로젝트 스타일 예시 + 내부 동작 원리

---

## 배경

terab 프로젝트(Java 21, Spring Boot, Lombok, JPA, JWT 인증, RBAC)를 기반으로 한 Spring Boot RESTful API 개발 가이드. 코드 작성 시 옆에 두고 참조하는 레퍼런스 문서.

---

## 파일 구조

```
docs/guides/spring-boot-rest-api/
├── README.md                          ← 전체 목차 (진입점)
├── 01-controller-layer.md
├── 02-service-layer.md
├── 03-jpa-repository-layer.md
├── 04-security-auth.md
├── 05-db-migration.md
├── 06-quick-reference.md              ← 카테고리별 Quick Reference (B타입)
└── anti-patterns/
    ├── README.md                      ← 안티패턴 목차 + 전체 항목 요약 테이블
    ├── 01-controller.md
    ├── 02-service.md
    ├── 03-jpa-repository.md
    ├── 04-db-migration.md
    ├── 05-exception-handling.md
    └── 06-security.md
```

---

## 각 파일 설계

### `README.md` — 전체 목차
- 레이어별 가이드 링크 (01~05)
- Quick Reference 링크
- 안티패턴 가이드 링크 → `anti-patterns/README.md`
- 프로젝트 컨벤션 요약 (terab 기준)

---

### `01-controller-layer.md`

**상단 요약 테이블 (12개 항목)**

| 어노테이션/타입 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@RestController` | ★★★ | HTTP 응답 자동 직렬화 | 클래스 | `@Controller`와 혼용 금지 |
| `@RequestMapping` | ★★★ | 공통 URL prefix 설정 | 클래스 | 메서드 레벨 중복 정의 주의 |
| `@GetMapping` | ★★★ | GET 요청 매핑 | 메서드 | - |
| `@PostMapping` | ★★★ | POST 요청 매핑 | 메서드 | `@RequestBody` 필수 페어 |
| `@PutMapping` | ★★☆ | 전체 리소스 교체 | 메서드 | PATCH와 용도 구분 |
| `@PatchMapping` | ★★☆ | 부분 업데이트 | 메서드 | - |
| `@DeleteMapping` | ★★☆ | 리소스 삭제 | 메서드 | - |
| `@PathVariable` | ★★★ | URL 경로 변수 바인딩 | 파라미터 | 타입 불일치 시 400 |
| `@RequestParam` | ★★☆ | 쿼리스트링 바인딩 | 파라미터 | `required` 기본값 `true` |
| `@RequestBody` | ★★★ | JSON → 객체 역직렬화 | 파라미터 | Entity 직접 바인딩 금지 |
| `@ResponseStatus` | ★★☆ | 응답 상태코드 고정 | 메서드 | `ResponseEntity`와 중복 주의 |
| `ResponseEntity<T>` | ★★★ | 상태코드+헤더+바디 제어 | 반환타입 | `void` 대신 권장 |

**본문 내용:**
- 각 항목별 설명 + terab 스타일 코드 예시 + 내부 동작 원리
- `@RestController` 내부: `@Controller` + `@ResponseBody` 합성 어노테이션임을 설명
- `ResponseEntity` vs `@ResponseStatus` 선택 기준
- HTTP 상태코드 관례 (200/201/204/400/401/403/404/409)

---

### `02-service-layer.md`

**상단 요약 테이블 (8개 항목)**

| 어노테이션/속성 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@Service` | ★★★ | 빈 등록 + 레이어 명시 | 클래스 | - |
| `@Transactional` | ★★★ | 트랜잭션 경계 설정 | 클래스/메서드 | self-invocation 함정 |
| `readOnly=true` | ★★★ | 조회 전용 트랜잭션 최적화 | 속성 | 쓰기 시도 시 예외 |
| `Propagation.REQUIRED` | ★★☆ | 기존 트랜잭션 참여 (기본값) | 속성 | - |
| `Propagation.REQUIRES_NEW` | ★☆☆ | 독립 트랜잭션 강제 생성 | 속성 | 중첩 커밋/롤백 독립 |
| `rollbackFor` | ★★☆ | 롤백 대상 예외 명시 | 속성 | CheckedException 기본 미롤백 |
| `@Async` | ★☆☆ | 비동기 실행 | 메서드 | `@EnableAsync` 필수 |
| `@Cacheable` | ★☆☆ | 메서드 결과 캐싱 | 메서드 | 캐시 키 설계 주의 |

**본문 내용:**
- `@Transactional` 프록시 기반 AOP 동작 원리 (왜 self-invocation이 동작하지 않는지)
- Propagation 전파 레벨 실용 정리 (REQUIRED / REQUIRES_NEW / NESTED)
- Isolation 격리 수준 실용 정리 (READ_COMMITTED 기본값, REPEATABLE_READ 사용 시점)
- `readOnly=true`가 성능에 미치는 영향 (dirty checking 생략, 커넥션 최적화)

---

### `03-jpa-repository-layer.md`

**상단 요약 테이블 (13개 항목)**

| 어노테이션 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@Entity` | ★★★ | JPA 엔티티 등록 | 클래스 | `@Data` 금지 |
| `@Table` | ★★☆ | 테이블명/인덱스 명시 | 클래스 | 생략 시 클래스명 사용 |
| `@Id` | ★★★ | PK 지정 | 필드 | 복합키는 `@EmbeddedId` |
| `@GeneratedValue` | ★★★ | PK 자동생성 전략 지정 | 필드 | UUID vs IDENTITY 선택 |
| `@Column` | ★★★ | 컬럼 제약조건 명시 | 필드 | `nullable=false` 권장 |
| `@OneToMany` | ★★★ | 1:N 관계 매핑 | 필드 | `fetch=LAZY` 기본값 확인 |
| `@ManyToOne` | ★★★ | N:1 관계 매핑 (연관관계 주인) | 필드 | `@JoinColumn` 필수 |
| `@ManyToMany` | ★☆☆ | M:N (중간 엔티티 대체 권장) | 필드 | 실무 사용 지양 |
| `@OneToOne` | ★★☆ | 1:1 관계 매핑 | 필드 | 지연로딩 설정 필요 |
| `@Embedded` | ★★☆ | 값 타입 임베딩 | 필드 | - |
| `@Query` | ★★☆ | 커스텀 JPQL 직접 작성 | 메서드 | 파라미터 바인딩 필수 |
| `@EntityGraph` | ★★☆ | N+1 해결 fetch join 명시 | 메서드 | 복잡 쿼리엔 QueryDSL |
| `@NoArgsConstructor(PROTECTED)` | ★★★ | JPA 기본 생성자 | 클래스 | `PUBLIC` 금지 |

**본문 내용:**
- 연관관계 주인 개념 (`@JoinColumn` 위치 = 외래키 관리 주체)
- `@GeneratedValue` 전략 비교: `IDENTITY` vs `UUID` (terab은 UUID 사용)
- Lombok + JPA 조합 패턴: terab `Permission.java` 기반 (`@Getter` + `@Builder` + `@NoArgsConstructor(PROTECTED)` + `@AllArgsConstructor`)
- 영속성 컨텍스트 생명주기 (MANAGED / DETACHED / REMOVED)

---

### `04-security-auth.md`

**상단 요약 테이블 (7개 항목)**

| 어노테이션/설정 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@EnableWebSecurity` | ★★★ | Spring Security 활성화 | 클래스 | `SecurityConfig`에 1회만 |
| `@SecurityFilterChain` | ★★★ | 필터 체인 빈 등록 | 메서드 | - |
| `@PreAuthorize` | ★★★ | 메서드 레벨 권한 검증 | 메서드 | `@EnableMethodSecurity` 필요 |
| `@Secured` | ★★☆ | 역할 기반 접근 제어 (단순) | 메서드 | SpEL 불가, `@PreAuthorize` 권장 |
| `@AuthenticationPrincipal` | ★★★ | 현재 인증 사용자 주입 | 파라미터 | `UserDetails` 구현체 직접 수신 |
| `@WithMockUser` | ★★☆ | 테스트용 인증 사용자 설정 | 테스트 | - |
| `permitAll` / `authenticated` | ★★★ | URL 패턴별 접근 제어 | 설정 | 순서 중요 (구체적 → 일반) |

**본문 내용:**
- JWT 필터 체인 동작 순서 (terab `JwtAuthenticationFilter` 기반)
- `@PreAuthorize("hasAuthority('file:read')")` — terab RBAC `리소스:액션` 패턴 연동
- `SecurityFilterChain` vs 구버전 `WebSecurityConfigurerAdapter` 차이
- CORS 설정 위치 (Security 레벨 vs Nginx 레벨, terab은 Nginx 처리)

---

### `05-db-migration.md`

**상단 요약 테이블 (6개 항목)**

| 설정/규칙 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `ddl-auto=none` | ★★★ | 스키마 변경 비활성화 (운영 권장) | application.yml | 운영 필수값 |
| `ddl-auto=validate` | ★★☆ | 엔티티-DB 스키마 일치 검증 | application.yml | Flyway와 함께 사용 |
| `ddl-auto=update` | ★☆☆ | 자동 스키마 변경 (개발만) | application.yml | 운영 절대 금지 |
| `V{n}__{desc}.sql` | ★★★ | Flyway 마이그레이션 파일 규칙 | 파일명 | 실행 후 수정 금지 |
| Repeatable (`R__`) | ★☆☆ | 반복 실행 마이그레이션 | 파일명 | 멱등성 보장 필수 |
| `baseline-on-migrate` | ★★☆ | 기존 DB에 Flyway 도입 시 기준점 | application.yml | 초기 도입 1회만 |

**본문 내용:**
- `ddl-auto` 각 옵션 동작 상세 + 환경별 권장값 표
- Flyway vs Liquibase 비교 (Flyway 권장 이유)
- 마이그레이션 파일 작성 원칙: 데이터 변환과 스키마 변경 분리
- 롤백 전략: Flyway는 유료 기능, 대안으로 Undo 스크립트 패턴

---

### `06-quick-reference.md`

**내용:**
- 전체 어노테이션을 6개 카테고리로 재분류한 색인 테이블
- 각 항목에서 해당 레이어 파일 링크
- 카테고리: 요청 매핑 / 요청 바인딩 / 응답 제어 / 트랜잭션 / JPA / 보안 / DB 마이그레이션

---

### `anti-patterns/README.md`

**내용:**
- 전체 29개 안티패턴 요약 테이블 (번호 / 패턴명 / 카테고리 / 위험도 / 파일 링크)
- 위험도: 🔴 데이터 손실 / 🟠 보안 취약점 / 🟡 성능 저하 / 🔵 유지보수 문제

---

### `anti-patterns/01-controller.md` ~ `06-security.md`

**각 파일 형식 (항목당):**
```
### AP-XX: [패턴명]
**위험도:** 🔴/🟠/🟡/🔵
**왜 문제인가:** 내부 동작 원리 기반 설명
❌ 잘못된 코드
✅ 올바른 코드
```

**항목 배분:**
- `01-controller.md`: 5개 (AP-01~05)
- `02-service.md`: 4개 (AP-06~09)
- `03-jpa-repository.md`: 7개 (AP-10~16)
- `04-db-migration.md`: 5개 (AP-17~21)
- `05-exception-handling.md`: 4개 (AP-22~25)
- `06-security.md`: 4개 (AP-26~29)

---

## 코드 예시 스타일

모든 코드 예시는 terab 프로젝트 컨벤션을 따름:
- Lombok: `@Getter`, `@Builder`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`, `@AllArgsConstructor`
- DTO: Request/Response 분리 (`LoginRequest`, `LoginResponse` 패턴)
- 예외: `ApiException` + `ErrorCode` + `GlobalExceptionHandler` 패턴
- 권한: `리소스:액션` 형식 (`file:read`, `user:manage`)
- UUID PK: `@GeneratedValue(strategy = GenerationType.UUID)`

---

## 제외 범위

- WebFlux / Reactive 관련 내용
- Spring Cloud / MSA 인프라 어노테이션
- 테스트 전용 어노테이션 (`@SpringBootTest` 등) — 별도 테스트 가이드로 분리 예정

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

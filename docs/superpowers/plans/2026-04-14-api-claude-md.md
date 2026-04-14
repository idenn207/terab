# services/api/CLAUDE.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/api/CLAUDE.md`를 생성하여 Spring Boot API 서비스 작업 시 Claude가 일관된 패턴·컨벤션을 따르도록 한다.

**Architecture:** 단일 파일(`services/api/CLAUDE.md`) 생성. 루트 `CLAUDE.md`에서 위임된 API 서비스 세부 컨벤션을 10개 섹션으로 구성. 코드 예시는 최소화하고 규칙 중심으로 작성한다.

**Tech Stack:** Markdown, Claude Code CLAUDE.md 규격

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `services/api/CLAUDE.md` | 신규 생성 |

---

### Task 1: services/api/CLAUDE.md 생성

**Files:**
- Create: `services/api/CLAUDE.md`

- [ ] **Step 1: CLAUDE.md 파일 생성**

아래 내용 그대로 `services/api/CLAUDE.md`를 생성한다.

```markdown
# services/api/CLAUDE.md

> 루트 CLAUDE.md의 세부 컨벤션입니다. 공통 원칙은 루트 CLAUDE.md를 참조하세요.

## 아키텍처 개요

### 패키지 구조

**도메인형(Domain-based) 패키지 구조**를 따른다.
계층(controller/service/repository)이 아닌 비즈니스 도메인 단위로 패키지를 구성한다.

각 도메인 패키지 내부 구성:

| 서브패키지 | 내용 |
|-----------|------|
| `domain/` | Entity, 비즈니스 로직 메서드, `@Embeddable`, 도메인 `Enum` |
| `dto/` | 요청·응답 Java record |
| `controller/` | REST 엔드포인트 |
| `service/` | 비즈니스 흐름 조율 |
| `repository/` | Spring Data JPA 인터페이스 |

도메인 패키지와 별도로 아래 3개 패키지가 공존한다:

| 패키지 | 역할 |
|--------|------|
| `security/` | JWT 생성·검증, Spring Security 설정 (횡단 관심사) |
| `common/` | `ApiException`, `ErrorCode`, `GlobalExceptionHandler`, 전역 유틸 |
| `config/` | 초기화 로직, 인프라 Bean 설정 |

### 레이어 의존 방향

```
Controller → Service → Repository
                     ↘ Domain (모든 레이어에서 참조 가능)
```

- Service는 다른 도메인의 Repository를 직접 호출하지 않는다
- 타 도메인 데이터가 필요한 경우 해당 도메인의 Service를 통해 접근한다

### 주요 명령어

```bash
./gradlew bootRun           # 로컬 실행
./gradlew test              # 단위 + 슬라이스 테스트
./gradlew integrationTest   # 통합 테스트 (Docker 필요)
./gradlew check             # 전체 테스트
./gradlew build             # 빌드 (JAR 생성)
```

## 코드 디자인 패턴

### Entity

- PK: `UUID` + `@GeneratedValue(strategy = GenerationType.UUID)`
- 타임스탬프: `OffsetDateTime` (LocalDateTime 사용 금지)
- `@PrePersist` / `@PreUpdate`로 `createdAt` / `updatedAt` 자동 설정
- 연관관계: 기본 `FetchType.LAZY`, EAGER 사용 금지
- `@Table(name = "...")` 항상 명시
- 불변 엔티티(Role, Permission 류): `@NoArgsConstructor(access = AccessLevel.PROTECTED)`
- `@Builder` 사용 금지 — 필드 직접 설정 방식 사용
- 도메인 판단 로직(`isValid()` 등)은 Entity 메서드로 작성

### DTO

- Java record 사용
- 네이밍: 요청 `XxxRequest`, 응답 `XxxResponse`
- Controller ↔ Service 경계에서만 사용; Entity를 직접 반환하지 않는다

### Service

- 클래스 레벨에 `@Transactional` 선언, 읽기 전용 메서드는 `@Transactional(readOnly = true)`
- `@RequiredArgsConstructor`로 생성자 주입
- 복잡한 흐름은 private 메서드로 분리
- Service가 다른 도메인 Repository를 직접 주입받지 않는다

### Repository

- Spring Data JPA 인터페이스만 선언
- 커스텀 JPQL은 `@Query`로 인터페이스 내에 작성
- Native Query는 성능상 불가피한 경우에만 사용

## 예외 처리

- 비즈니스 예외는 `ApiException(ErrorCode)` 사용 — 직접 `RuntimeException` throw 금지
- `ErrorCode` enum에 메시지(`message`)와 HTTP 상태(`HttpStatus`)를 함께 정의
- 새 ErrorCode 추가 기준: 클라이언트가 원인을 구분해 다르게 대응해야 하는 경우에만 추가
- 서버 내부 오류(5xx)는 `GlobalExceptionHandler`에서 일괄 처리
- 입력 유효성 오류는 `@Valid` + `MethodArgumentNotValidException`으로 처리 (별도 예외 불필요)
- `GlobalExceptionHandler` 외부에서 `ResponseEntity`를 직접 구성하지 않는다

## 보안

### JWT

- Access Token: `Authorization: Bearer <token>` 헤더로 전달 (기본 만료: 15분)
- Refresh Token: HttpOnly Secure 쿠키(`refreshToken`), path `/api/auth` (기본 만료: 7일)
- RT는 DB에 해시값만 저장 (`TokenHasher`) — 평문 저장 금지
- Refresh 시 RT Rotation 적용 (기존 토큰 즉시 폐기 후 신규 발급)
- 재사용 RT 감지 시 해당 사용자의 모든 활성 RT 즉시 무효화 (family invalidation)

### Spring Security

- 새 엔드포인트 추가 시 `SecurityConfig`에 인가 규칙을 명시적으로 선언
- 기본 정책은 deny-all — 명시되지 않은 경로는 인증 필요로 처리
- `@PreAuthorize` 사용 시 Permission 문자열은 `resource:action` 형식 준수
- 관리자 기능과 일반 기능은 URL 경로로 분리하고 역할별 인가를 `SecurityConfig`에서 선언

### RESTful API 보안

**입력 검증**
- 모든 요청 바디에 `@Valid` 적용 필수 — Controller 파라미터에서 생략 금지
- JPQL 파라미터는 반드시 바인딩 변수 사용 (문자열 연결 금지)
- 컬렉션·페이지 파라미터에 상한값 검증 필수

**인가 및 소유권 검증 (OWASP API1 — BOLA)**
- 리소스 조회·수정·삭제 시 Service 레이어에서 소유권 검증 필수
- `@AuthenticationPrincipal`로 추출한 `userId`와 리소스 소유자 ID를 비교 후 처리

**응답 데이터 보호 (OWASP API3)**
- 응답 DTO에 `password`, `tokenHash` 등 민감 필드 포함 금지
- Entity를 Controller에서 직접 반환하지 않는다

**리소스 소비 제한 (OWASP API4)**
- 목록 조회 API는 페이지네이션 필수, 전체 반환 금지
- 인증 엔드포인트(`/api/auth/login`, `/api/auth/refresh`)에 요청 횟수 제한 적용

**보안 설정 관리 (OWASP API8)**
- CORS 허용 오리진은 `application.yml`에서 명시 관리 — 와일드카드(`*`) 금지

**로깅 보안**
- JWT, Refresh Token, 비밀번호, pepper 값을 로그에 출력 금지
- 예외 메시지에 민감 정보 포함 여부 확인 후 기록

## RESTful 가이드

### URL 설계

- 기본 경로: `/api/{resource}` — resource는 복수 명사, kebab-case
- 계층 관계: `/api/{resource}/{id}/{sub-resource}`
- 3단계 이상 중첩 금지 — 별도 엔드포인트로 분리
- 행위는 URL에 포함하지 않는다 — HTTP 메서드로 표현

### HTTP 메서드 · 상태 코드

| 작업 | 메서드 | 성공 응답 |
|------|--------|-----------|
| 조회 | GET | 200 OK |
| 생성 | POST | 201 Created |
| 전체 수정 | PUT | 200 OK |
| 부분 수정 | PATCH | 200 OK |
| 삭제 | DELETE | 204 No Content |

- 모든 응답은 `ResponseEntity<T>` 반환
- 오류 응답 구조는 `ErrorResponse`로 통일

## DB 컨벤션

### 스키마 설계

- PK: `UUID` + `DEFAULT gen_random_uuid()`
- 타임스탬프: `TIMESTAMPTZ` (TIMESTAMP 사용 금지)
- 테이블·컬럼명: `snake_case`
- 문자열: `VARCHAR(n)` — 길이 명시 필수
- FK: `ON DELETE` 동작 명시 필수 (`CASCADE` / `SET NULL` / `RESTRICT`)
- NULL 허용 여부를 항상 명시 (`NOT NULL` 또는 의도적 nullable)

### 인덱스 · 최적화

- FK 컬럼에 인덱스 필수
- 다중 컬럼 `WHERE` 조건은 복합 인덱스 고려
- 부분 조건(예: `active = true`)이 반복되면 Partial Index 고려
- 인덱스 추가 전 `EXPLAIN ANALYZE`로 실행 계획 확인
- N+1 방지: `JOIN FETCH` 또는 `@EntityGraph` 사용, Lazy 연관관계 무분별한 접근 금지

## Flyway 마이그레이션

- 파일명: `V{n}__{설명}.sql` — 버전은 순번, 설명은 `snake_case`
  - 예: `V3__add_file_nodes_table.sql`
- 한 번 적용된 마이그레이션 파일은 수정 금지 — 변경 필요 시 신규 버전 추가
- 스키마 변경과 시드 데이터는 같은 파일에 작성 가능
- 마이그레이션 파일은 항상 멱등성 확보 (`IF NOT EXISTS`, `IF EXISTS` 활용)

## Spring Boot 패턴 · 주의사항

### 의존성 주입

- 생성자 주입만 사용 (`@RequiredArgsConstructor`) — 필드 `@Autowired` 금지
- 순환 의존성 발생 시 설계 문제로 간주, 패키지 구조 재검토

### 설정값 관리

- 단순 값: `@Value("${...}")` 사용
- 관련 설정이 3개 이상이면 `@ConfigurationProperties` 클래스로 묶는다
- 설정값 기본값은 `application.yml`에서 관리 — 코드 내 하드코딩 금지

### @Transactional 주의사항

- 같은 클래스 내 `@Transactional` 메서드를 자체 호출(self-invocation)하면 트랜잭션이 적용되지 않는다
- `open-in-view: false` 설정으로 인해 트랜잭션 밖에서 Lazy 연관관계 접근 시 `LazyInitializationException` 발생
  — Service 레이어에서 필요한 연관관계를 반드시 로딩 후 반환

### 초기화 로직

- 앱 구동 시 1회 실행 초기화는 `ApplicationRunner` 사용 (`config/` 패키지)
- 멱등성 보장 필수 — 재시작 시 중복 실행되어도 안전해야 한다

### 프로파일

| 프로파일 | 용도 |
|----------|------|
| (기본) | 운영 설정 |
| `local` | 로컬 개발 (`application-local.yml`) |
| `test` | 슬라이스 테스트 |
| `integration` | 통합 테스트 (Testcontainers) |

## 테스트 컨벤션

> 상세 가이드: `src/test/TDD_GUIDE.md`

### 테스트 계층 선택 기준

| 대상 | 계층 | 위치 |
|------|------|------|
| Service · 도메인 로직 | Unit | `src/test/.../unit/` |
| Controller (HTTP · Security) | Slice (`@WebMvcTest`) | `src/test/.../slice/` |
| Repository · 전체 플로우 | Integration (Testcontainers) | `src/intTest/.../integration/` |

### 작성 규칙

- 메서드명: `should_동작_when_조건` 형식
- `@Nested` + `@DisplayName`으로 메서드·시나리오 단위 그룹화
- Given / When / Then 주석으로 구조 명시
- 템플릿 파일(`_*Template.java`) 복사 후 사용, 원본 수정 금지
- Integration Test는 `@Transactional`로 각 테스트 후 자동 롤백

## Javadoc · 주석 정책

- 공개 API가 아닌 내부 서비스이므로 `/** */` Javadoc 작성 불필요
- 주석은 **왜(why)** 를 설명할 때만 작성, 한글로 작성
- 잘못된 예: `// 토큰을 검증한다`
- 올바른 예: `// JWT 서명은 유효하나 DB에 일치하는 RT 없음 = 이미 rotate된 토큰 재사용 시도`

## Claude 행동 지침 (API)

- 새 도메인 추가 시 `domain · dto · controller · service · repository` 구조를 따른다
- 새 엔드포인트 추가 시 `SecurityConfig`에 인가 규칙을 반드시 함께 작성한다
- Entity 변경이 DB 스키마에 영향을 주면 Flyway 마이그레이션 파일을 함께 생성한다
- 테스트 작성 계층은 위 기준표를 따른다 — 모든 신규 기능에 최소 Unit 또는 Slice 테스트 포함
- `application-local.yml`, `application-*.yml` 환경 설정 파일 수정 전 반드시 확인
```

- [ ] **Step 2: 줄 수 검증**

```bash
wc -l services/api/CLAUDE.md
```

기댓값: 200줄 이상 500줄 이하

- [ ] **Step 3: 커밋**

```bash
git add services/api/CLAUDE.md
git commit -m "docs: services/api/CLAUDE.md 추가 — Spring Boot API 서비스 컨벤션 정의"
```

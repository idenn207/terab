# services/api/CLAUDE.md 설계 문서

**목적:** `services/api/CLAUDE.md` 파일 내용 구성 — Spring Boot API 서비스의 세부 컨벤션, 패턴, Claude 행동 지침 정의

**범위:** 아키텍처 개요, 코드 디자인 패턴, 예외 처리, 보안, RESTful 가이드, DB 컨벤션, Flyway 마이그레이션, Spring Boot 주의사항, 테스트 컨벤션, Javadoc 정책, Claude 행동 지침

**출력물:** `services/api/CLAUDE.md` (단일 파일, 500줄 이내)

---

## 섹션 구성

### 1. 아키텍처 개요

**패키지 구조 설명 방식:**
- 도메인형(Domain-based) 패키지 구조임을 명시
- 현재 폴더를 열거하지 않고, "feature 단위로 구성"하는 원칙 강조
- 각 feature 패키지 내부 서브패키지 역할 테이블로 정리
- `domain/`의 역할: Entity + 비즈니스 로직 메서드 + `@Embeddable` + 도메인 Enum
- 예외 패키지 3개(`security/`, `common/`, `config/`)는 별도 테이블로 역할 설명

**레이어 의존 방향:**
- `Controller → Service → Repository`
- Domain은 모든 레이어에서 참조 가능
- Service가 타 도메인 Repository를 직접 호출하지 않는다는 규칙 명시

**주요 명령어:**
- `./gradlew bootRun`, `test`, `integrationTest`, `check`, `build`

---

### 2. 코드 디자인 패턴

**Entity 컨벤션:**
- UUID PK + `@GeneratedValue(strategy = GenerationType.UUID)`
- 타임스탬프: `OffsetDateTime` (LocalDateTime 금지)
- `@PrePersist` / `@PreUpdate`로 `createdAt` / `updatedAt` 자동 설정
- 연관관계: 기본 `FetchType.LAZY`, EAGER 사용 금지
- `@Table(name = "...")` 항상 명시
- 불변 엔티티(Role, Permission): `@NoArgsConstructor(access = AccessLevel.PROTECTED)`
- `@Builder` 사용 금지, 필드 직접 설정 방식 사용
- 도메인 판단 로직은 Entity 메서드로 작성 (예: `isValid()`)

**DTO 컨벤션:**
- Java record 사용
- 네이밍: `XxxRequest`, `XxxResponse`
- Controller ↔ Service 경계에서만 사용, Entity 직접 반환 금지

**Service 컨벤션:**
- 클래스 레벨 `@Transactional`, 읽기 전용은 `@Transactional(readOnly = true)`
- `@RequiredArgsConstructor` 생성자 주입
- 복잡한 흐름은 private 메서드로 분리
- 타 도메인 Repository 직접 주입 금지

**Repository 컨벤션:**
- Spring Data JPA 인터페이스만 선언
- 커스텀 JPQL은 `@Query`로 인터페이스 내 작성
- Native Query는 성능상 불가피한 경우에만 사용

---

### 3. 예외 처리

- 비즈니스 예외: `ApiException(ErrorCode)` 사용, 직접 `RuntimeException` throw 금지
- `ErrorCode` enum: 메시지 + HttpStatus 함께 정의
- 새 ErrorCode 추가 기준: 클라이언트가 원인을 구분해 다르게 대응해야 하는 경우에만 추가
- 서버 내부 오류(5xx)는 `GlobalExceptionHandler`에서 일괄 처리
- 입력 유효성 오류: `@Valid` + `MethodArgumentNotValidException`으로 처리 (별도 예외 불필요)
- `GlobalExceptionHandler` 외부에서 `ResponseEntity` 직접 구성 금지

---

### 4. 보안

**JWT:**
- Access Token: `Authorization: Bearer <token>` 헤더 (기본 만료 15분)
- Refresh Token: HttpOnly Secure 쿠키(`refreshToken`), path `/api/auth` (기본 만료 7일)
- RT는 DB에 해시값만 저장 (`TokenHasher`) — 평문 저장 금지
- Refresh 시 RT Rotation (기존 폐기 후 신규 발급)
- 재사용 RT 감지 시 해당 사용자 모든 활성 RT 즉시 무효화 (family invalidation)

**Spring Security:**
- 새 엔드포인트 추가 시 `SecurityConfig`에 인가 규칙 명시적 선언
- 기본 정책 deny-all — 명시되지 않은 경로는 인증 필요 처리
- `@PreAuthorize` Permission 문자열은 `resource:action` 형식

**RESTful API 보안 (OWASP API Security Top 10 기반):**
- **입력 검증**: 모든 요청 바디 `@Valid` 필수, JPQL 파라미터 바인딩 변수 사용, 컬렉션 파라미터 상한값 검증
- **소유권 검증 (API1 — BOLA)**: 리소스 조회·수정·삭제 시 Service 레이어에서 `userId` 비교 후 처리
- **응답 보호 (API3)**: 응답 DTO에 `password`, `tokenHash` 등 민감 필드 포함 금지, Entity 직접 반환 금지
- **리소스 소비 제한 (API4)**: 목록 조회 API 페이지네이션 필수, 인증 엔드포인트 요청 횟수 제한
- **보안 설정 (API8)**: CORS 허용 오리진 `application.yml`에서 명시 관리, 와일드카드(`*`) 금지
- **로깅 보안**: JWT, RT, 비밀번호, pepper 값 로그 출력 금지

---

### 5. RESTful 가이드

**URL 설계:**
- 기본 경로: `/api/{resource}` — resource는 복수 명사, kebab-case
- 계층 관계: `/api/{resource}/{id}/{sub-resource}`, 3단계 이상 중첩 금지
- 행위는 URL에 포함하지 않고 HTTP 메서드로 표현

**HTTP 메서드·상태 코드 테이블:**
- GET → 200, POST → 201, PUT/PATCH → 200, DELETE → 204
- 모든 응답 `ResponseEntity<T>` 반환, 오류 응답 `ErrorResponse` 구조 통일

---

### 6. DB 컨벤션

**스키마 설계:**
- PK: UUID + `DEFAULT gen_random_uuid()`
- 타임스탬프: `TIMESTAMPTZ` (TIMESTAMP 금지)
- 테이블·컬럼명: `snake_case`
- 문자열: `VARCHAR(n)` 길이 명시 필수
- FK: `ON DELETE` 동작 명시 필수
- NULL 허용 여부 항상 명시

**인덱스·최적화:**
- FK 컬럼에 인덱스 필수
- 다중 컬럼 WHERE 조건은 복합 인덱스 고려
- 부분 조건 반복 시 Partial Index 고려
- 인덱스 추가 전 `EXPLAIN ANALYZE`로 실행 계획 확인
- N+1 방지: `JOIN FETCH` 또는 `@EntityGraph` 사용

**Flyway:**
- 파일명: `V{n}__{설명}.sql`, 설명은 `snake_case`
- 한 번 적용된 파일 수정 금지 — 변경 시 신규 버전 추가
- 스키마 변경과 시드 데이터 같은 파일 작성 가능
- 멱등성 보장 (`IF NOT EXISTS`, `IF EXISTS` 활용)

---

### 7. Spring Boot 패턴·주의사항

- 의존성 주입: 생성자 주입만 사용 (`@RequiredArgsConstructor`), 필드 `@Autowired` 금지
- 순환 의존성 발생 시 설계 문제로 간주, 패키지 구조 재검토
- 설정값: 단순 값은 `@Value`, 관련 설정 3개 이상이면 `@ConfigurationProperties`
- self-invocation 주의: 같은 클래스 내 `@Transactional` 메서드 자체 호출 시 트랜잭션 미적용
- `open-in-view: false` — 트랜잭션 밖 Lazy 접근 시 `LazyInitializationException`
- 초기화 로직: `ApplicationRunner` 사용, 멱등성 보장 필수
- 프로파일: 기본(운영) / `local` / `test` / `integration`

---

### 8. 테스트 컨벤션

상세 가이드는 `src/test/TDD_GUIDE.md` 참조.

**계층 선택 기준 테이블:**
- Unit: Service · 도메인 로직 (`src/test/.../unit/`)
- Slice(`@WebMvcTest`): Controller (HTTP · Security) (`src/test/.../slice/`)
- Integration(Testcontainers): Repository · 전체 플로우 (`src/intTest/.../integration/`)

**작성 규칙:**
- 메서드명: `should_동작_when_조건`
- `@Nested` + `@DisplayName`으로 그룹화
- Given / When / Then 주석 구조
- 템플릿 파일(`_*Template.java`) 복사 후 사용, 원본 수정 금지
- Integration Test는 `@Transactional`로 자동 롤백

---

### 9. Javadoc · 주석 정책

- 내부 서비스이므로 `/** */` Javadoc 작성 불필요
- 주석은 **왜(why)** 를 설명할 때만, 한글 작성
- 잘못된 예: `// 토큰을 검증한다`
- 올바른 예: `// JWT 서명은 유효하나 DB에 일치하는 RT 없음 = 이미 rotate된 토큰 재사용 시도`

---

### 10. Claude 행동 지침 (API 특화)

- 새 도메인 추가 시 `domain · dto · controller · service · repository` 구조를 따른다
- 새 엔드포인트 추가 시 `SecurityConfig` 인가 규칙을 반드시 함께 작성한다
- Entity 변경이 DB 스키마에 영향을 주면 Flyway 마이그레이션 파일을 함께 생성한다
- 테스트 계층 기준표를 따라 신규 기능에 최소 Unit 또는 Slice 테스트 포함
- `application-local.yml`, `application-*.yml` 환경 설정 파일 수정 전 반드시 확인

---

## 줄 수 목표

- 목표: 300줄 내외, 최대 500줄 이내
- 코드 예시: 오해 소지 있는 규칙에만 최소화

## 산출물

| 파일 | 작업 |
|------|------|
| `services/api/CLAUDE.md` | 신규 생성 |

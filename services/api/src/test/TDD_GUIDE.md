# Backend TDD 가이드라인

## 테스트 레이어

### 1. Unit Test (단위 테스트)

- **위치**: `src/test/java/.../unit/`
- **실행**: `./gradlew test`
- **대상**: Service, Utility, Domain 로직
- **도구**: JUnit 5 + Mockito + AssertJ
- **Spring Context**: 로드하지 않음 (`@ExtendWith(MockitoExtension.class)`)
- **속도**: 밀리초 단위

**언제 사용하나?**
- 비즈니스 로직 테스트 (Service 클래스)
- 유틸리티 함수 테스트
- 외부 의존성 없이 단일 클래스를 검증할 때

### 2. Slice Test (슬라이스 테스트)

- **위치**: `src/test/java/.../slice/`
- **실행**: `./gradlew test`
- **대상**: Controller (HTTP 요청/응답, 시큐리티)
- **도구**: `@WebMvcTest` + MockMvc + `@MockBean`
- **Spring Context**: 웹 레이어만 부분 로드
- **속도**: 초 단위

**언제 사용하나?**
- API 엔드포인트의 요청/응답 형식 검증
- Spring Security 인가 규칙 테스트
- 입력 유효성 검증 (@Valid) 테스트

### 3. Integration Test (통합 테스트)

- **위치**: `src/intTest/java/.../integration/`
- **실행**: `./gradlew integrationTest`
- **대상**: Repository, 복합 비즈니스 플로우, API 전체 흐름
- **도구**: `@SpringBootTest` + Testcontainers (PostgreSQL, MinIO)
- **Spring Context**: 전체 로드
- **속도**: 수 초 단위 (컨테이너 시작은 최초 1회)

**언제 사용하나?**
- Repository 쿼리가 실제 DB에서 올바르게 동작하는지 검증
- 여러 계층을 걸치는 비즈니스 플로우 테스트
- Flyway 마이그레이션 검증

## 테스트 작성 원칙

### Given-When-Then 패턴

```java
@Test
void should_create_folder_under_parent() {
    // given - 테스트 준비
    Long parentId = 1L;
    String folderName = "Documents";

    // when - 테스트 대상 실행
    FileNode folder = fileNodeService.createFolder(userId, parentId, folderName);

    // then - 결과 검증
    assertThat(folder.getName()).isEqualTo("Documents");
    assertThat(folder.getType()).isEqualTo("FOLDER");
}
```

### 네이밍 규칙

- 메서드명: `should_동작_when_조건` 또는 `should_동작`
- 예: `should_throw_when_email_is_duplicate()`
- 예: `should_return_children_of_folder()`

### 핵심 규칙

1. **한 테스트, 한 검증**: 하나의 테스트는 하나의 행위만 검증
2. **테스트 간 독립성**: 테스트 실행 순서에 의존하지 않음
3. **구현이 아닌 행위 테스트**: 내부 구현이 아닌 외부에서 관찰 가능한 행위를 검증
4. **테스트도 코드다**: 중복 제거, 가독성 유지

## 실행 명령어

```bash
# 단위 + 슬라이스 테스트 (빠름, Docker 불필요)
./gradlew test

# 통합 테스트 (Testcontainers, Docker 필요)
./gradlew integrationTest

# 전체 테스트
./gradlew check

# 특정 테스트 클래스만 실행
./gradlew test --tests "com.nasdrive.api.unit.FileNodeServiceTest"
./gradlew integrationTest --tests "com.nasdrive.api.integration.FileNodeRepositoryTest"
```

## 유틸리티 클래스

- `SecurityTestSupport` (`src/test/.../support/`): 인증된 요청 생성 헬퍼
- `IntegrationTestBase` (`src/intTest/.../support/`): 통합 테스트 베이스 클래스
- `TestContainersConfig` (`src/intTest/.../support/`): 싱글톤 컨테이너 설정

# DDD 아키텍처 설계 — UseCase · Service · Domain 레이어 분리

## 배경

기존 `service/` 레이어가 Application Service(유즈케이스 조율)와 Domain Service(재사용 비즈니스 로직)의 역할을 동시에 수행하고 있었다. 또한 `AuthService`, `DeviceService`가 타 도메인의 Repository를 직접 주입받는 교차 도메인 의존이 존재했다. SOLID 원칙을 기반으로 레이어를 명확히 분리하고 도메인 간 참조 규칙을 수립한다.

---

## 레이어 의존 방향

```
Controller
    ↓ (IXxxUseCase 인터페이스 의존)
UseCase (application/)       ← 유즈케이스 단위 흐름 조율, @Transactional 소유
    ↓
Service (service/)           ← 단일 도메인 재사용 비즈니스 로직
    ↓
Repository (repository/)     ← DB 접근 인터페이스
    ↓
Domain Entity (domain/)      ← Repository가 참조하여 영속성 관리
```

Domain Entity는 Service·UseCase가 데이터로 전달·수신한다. Controller는 Entity 직접 참조 금지.

---

## 패키지 구조

각 도메인 패키지 내부 구성:

| 서브패키지 | 내용 |
|-----------|------|
| `application/` | UseCase 구체 클래스 — 유즈케이스 단위 흐름 조율, 트랜잭션 소유 |
| `application/interface/` | UseCase 인터페이스 (`I` 접두사) |
| `service/` | Domain Service — 단일 도메인 재사용 비즈니스 로직 |
| `domain/` | Entity, 비즈니스 판단 메서드, `@Embeddable`, 도메인 `Enum` |
| `dto/` | 요청·응답 Java record |
| `controller/` | REST 엔드포인트 |
| `repository/` | Spring Data JPA 인터페이스 |

공통 패키지:

| 패키지 | 역할 |
|--------|------|
| `common/usecase/` | `UseCase` 마커 인터페이스 |

패키지 예시:

```
auth/
  application/
    interface/
      ILoginUseCase.java
      IRefreshTokenUseCase.java
      ILogoutUseCase.java
    LoginUseCase.java
    RefreshTokenUseCase.java
    LogoutUseCase.java
  service/
    AuthService.java
  controller/
    AuthController.java
  domain/
    RefreshToken.java
  repository/
    RefreshTokenRepository.java
  dto/
    LoginRequest.java
    LoginResponse.java

device/
  application/
    interface/
      IRegisterPushTokenUseCase.java
    RegisterPushTokenUseCase.java
  service/
    DeviceService.java
  ...

common/
  usecase/
    UseCase.java
```

---

## UseCase 설계

### 마커 인터페이스

```java
// common/usecase/UseCase.java
public interface UseCase {}
```

### Interface + 구체 클래스 구조

```java
// auth/application/interface/ILoginUseCase.java
public interface ILoginUseCase extends UseCase {
    LoginResponse execute(LoginRequest request, HttpServletResponse response);
}

// auth/application/LoginUseCase.java
@Component
@RequiredArgsConstructor
public class LoginUseCase implements ILoginUseCase {

    private final UserService userService;
    private final AuthService authService;

    @Transactional
    @Override
    public LoginResponse execute(LoginRequest request, HttpServletResponse response) {
        User user = userService.getByUsername(request.username());
        authService.validateCredentials(user, request.password());
        return authService.issueTokens(user, response);
    }
}

// auth/controller/AuthController.java
@RequiredArgsConstructor
public class AuthController {
    private final ILoginUseCase loginUseCase;  // 인터페이스에만 의존

    public ResponseEntity<LoginResponse> login(...) {
        return ResponseEntity.ok(loginUseCase.execute(request, response));
    }
}
```

### 명명 규칙

| 구분 | 패턴 | 예시 |
|------|------|------|
| 인터페이스 | `I{동사}{대상}UseCase` | `ILoginUseCase` |
| 구체 클래스 | `{동사}{대상}UseCase` | `LoginUseCase` |
| 메서드 | `execute(...)` 통일 | — |

- DTO를 파라미터로 직접 사용 (Command 래퍼 없음)
- 단일 public 메서드 `execute()`만 노출

---

## 트랜잭션 경계

| 레이어 | `@Transactional` 선언 |
|--------|----------------------|
| UseCase 구체 클래스 | `execute()` 메서드에 선언 — 트랜잭션 소유자 |
| Service | 선언 없음 (원칙) — UseCase 트랜잭션에 REQUIRED 전파로 참여 |
| Service (단독 호출) | 메서드 레벨 선언 허용 — Security Filter 등 UseCase 없이 직접 호출되는 경우 |

Spring 기본 전파 전략 `REQUIRED`에 의해 UseCase 트랜잭션 안에서 Service 호출이 모두 동일 트랜잭션에 참여한다.

---

## 도메인 간 참조 규칙

- **Service → 타 도메인 Repository 직접 주입 금지**
- **Service → 타 도메인 Service 직접 주입 금지**
- **교차 도메인 조합은 UseCase에서만 허용**

```java
// ❌ 금지
@Service
public class DeviceService {
    private final UserRepository userRepository; // 타 도메인 Repository 직접 주입
}

// ✅ 허용
@Component
public class RegisterPushTokenUseCase implements IRegisterPushTokenUseCase {
    private final UserService userService;     // UseCase가 타 도메인 Service 조합
    private final DeviceService deviceService;
}
```

---

## DTO · Entity 레이어별 참조 규칙

| 레이어 | 허용 타입 |
|--------|----------|
| Controller | Request DTO (입력) · Response DTO (출력) — Entity 직접 참조 금지 |
| UseCase | Request DTO 입력 / Response DTO 반환 / Entity 변환 담당 |
| Service | Entity · 원시값만 (DTO 금지) |
| Repository | Entity만 |
| Domain Entity | 다른 레이어 참조 없음 (단방향) |

---

## 리팩토링 대상 (현재 위반 사례)

| 파일 | 위반 내용 | 조치 |
|------|-----------|------|
| `auth/service/AuthService` | `UserRepository` 직접 주입, 유즈케이스 흐름 포함 | `LoginUseCase`, `RefreshTokenUseCase`, `LogoutUseCase` 분리 |
| `device/service/DeviceService` (계획 중) | `UserRepository` 직접 주입 | `RegisterPushTokenUseCase`로 분리 |

---

## CLAUDE.md 반영 항목

1. 패키지 구조표에 `application/`, `application/interface/` 서브패키지 추가
2. 레이어 의존 방향 다이어그램 교체
3. UseCase 섹션 신규 추가 (마커 인터페이스, I 접두사 인터페이스, 구체 클래스, 명명, 트랜잭션)
4. 도메인 간 참조 규칙 신규 추가
5. Service 섹션: `@Transactional` 규칙 수정
6. DTO 섹션: 레이어별 참조 규칙 명확화
7. Claude 행동 지침: UseCase/Service 작성 기준 추가

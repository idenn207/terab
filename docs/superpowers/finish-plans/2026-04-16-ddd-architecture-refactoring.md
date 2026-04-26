# DDD 아키텍처 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `application/` UseCase 레이어를 도입하여 유즈케이스 조율·트랜잭션 경계를 분리하고, 도메인 간 교차 의존을 제거한다.

**Architecture:** `Controller → IXxxUseCase(interface) → XxxUseCase(impl) → Service → Repository` 구조. UseCase가 @Transactional을 소유하고 여러 도메인 Service를 조합한다. Service는 단일 도메인 책임만 갖는다.

**Tech Stack:** Spring Boot 4.x / Java 25 / Spring Data JPA / Lombok

---

## 파일 맵

### 신규 생성

```
services/api/src/main/java/com/terab/api/common/usecase/UseCase.java

services/api/src/main/java/com/terab/api/auth/application/interfaces/ILoginUseCase.java
services/api/src/main/java/com/terab/api/auth/application/interfaces/IRefreshTokenUseCase.java
services/api/src/main/java/com/terab/api/auth/application/interfaces/ILogoutUseCase.java
services/api/src/main/java/com/terab/api/auth/application/interfaces/IGetCurrentUserUseCase.java
services/api/src/main/java/com/terab/api/auth/application/LoginUseCase.java
services/api/src/main/java/com/terab/api/auth/application/RefreshTokenUseCase.java
services/api/src/main/java/com/terab/api/auth/application/LogoutUseCase.java
services/api/src/main/java/com/terab/api/auth/application/GetCurrentUserUseCase.java

services/api/src/main/java/com/terab/api/device/application/interfaces/IRegisterPushTokenUseCase.java
services/api/src/main/java/com/terab/api/device/application/RegisterPushTokenUseCase.java
services/api/src/main/java/com/terab/api/device/service/DeviceService.java

services/api/src/test/java/com/terab/api/unit/auth/LoginUseCaseTest.java
services/api/src/test/java/com/terab/api/unit/auth/RefreshTokenUseCaseTest.java
services/api/src/test/java/com/terab/api/unit/auth/LogoutUseCaseTest.java
```

### 수정

```
services/api/src/main/java/com/terab/api/user/service/UserService.java          (getUserProfile 제거, findByUsername·findById 추가)
services/api/src/main/java/com/terab/api/auth/service/AuthService.java           (UserRepository 제거, 도메인 메서드만 남김)
services/api/src/main/java/com/terab/api/auth/controller/AuthController.java     (AuthService → IXxxUseCase 교체)
services/api/src/main/java/com/terab/api/device/controller/DeviceController.java (IRegisterPushTokenUseCase 주입)
services/api/src/test/java/com/terab/api/slice/AuthControllerTest.java           (AuthService Mock → UseCase 인터페이스 Mock)
services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java         (DeviceService Mock → IRegisterPushTokenUseCase Mock)
services/api/CLAUDE.md
```

### 삭제

```
services/api/src/main/java/com/terab/api/user/dto/UserProfile.java   (UserService 리팩토링 후 미사용)
```

---

## Task 1: UseCase 마커 인터페이스 생성

**Files:**
- Create: `services/api/src/main/java/com/terab/api/common/usecase/UseCase.java`

- [ ] **Step 1: UseCase.java 생성**

```java
package com.terab.api.common.usecase;

public interface UseCase {}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/java/com/terab/api/common/usecase/UseCase.java
git commit -m "feat: UseCase 마커 인터페이스 추가"
```

---

## Task 2: CLAUDE.md 업데이트

**Files:**
- Modify: `services/api/CLAUDE.md`

- [ ] **Step 1: 패키지 구조표 수정**

`### 패키지 구조` 섹션의 도메인 패키지 내부 구성 표를 아래로 교체한다:

```markdown
| 서브패키지 | 내용 |
|-----------|------|
| `application/` | UseCase 구체 클래스 — 유즈케이스 단위 흐름 조율, 트랜잭션 소유 |
| `application/interfaces/` | UseCase 인터페이스 (`I` 접두사) |
| `domain/` | Entity, 비즈니스 로직 메서드, `@Embeddable`, 도메인 `Enum` |
| `dto/` | 요청·응답 Java record |
| `controller/` | REST 엔드포인트 |
| `service/` | Domain Service — 단일 도메인 재사용 비즈니스 로직 |
| `repository/` | Spring Data JPA 인터페이스 |
```

- [ ] **Step 2: 레이어 의존 방향 다이어그램 교체**

`### 레이어 의존 방향` 섹션 전체를 아래로 교체한다:

```markdown
### 레이어 의존 방향

\`\`\`
Controller
    ↓ (IXxxUseCase 인터페이스 의존)
UseCase (application/)       ← 유즈케이스 단위 흐름 조율, @Transactional 소유
    ↓
Service (service/)           ← 단일 도메인 재사용 비즈니스 로직
    ↓
Repository (repository/)     ← DB 접근 인터페이스
    ↓
Domain Entity (domain/)      ← Repository가 참조하여 영속성 관리
\`\`\`

Domain Entity는 Service·UseCase가 데이터로 전달·수신한다. Controller는 Entity 직접 참조 금지.
```

- [ ] **Step 3: UseCase 섹션 신규 추가**

`### Service` 섹션 바로 위에 아래를 삽입한다:

```markdown
### UseCase

- `common/usecase/UseCase.java` 마커 인터페이스를 구현한다
- 인터페이스는 `application/interfaces/` 에 위치, 명명: `I{동사}{대상}UseCase`
- 구체 클래스는 `application/` 에 위치, 명명: `{동사}{대상}UseCase`
- 진입 메서드명: `execute(...)` 통일, DTO를 직접 파라미터로 사용 (Command 래퍼 없음)
- `@Transactional`은 구체 클래스의 `execute()` 메서드에 선언 — 트랜잭션 소유자
- 여러 도메인의 Service를 자유롭게 조합 가능
- Controller는 UseCase 인터페이스(`IXxxUseCase`)에만 의존, 구체 클래스 직접 주입 금지
```

- [ ] **Step 4: Service 섹션 @Transactional 규칙 수정**

`### Service` 섹션의 첫 번째 항목을 아래로 교체한다:

기존:
```
- 클래스 레벨에 `@Transactional` (기본 read-write) 선언, 읽기 전용 메서드만 `@Transactional(readOnly = true)`로 오버라이드
```

변경 후:
```
- 클래스 레벨 `@Transactional` 선언하지 않는다 — UseCase 트랜잭션에 REQUIRED 전파로 참여
- DB 쓰기 메서드: 메서드 레벨 `@Transactional` 선언
- DB 읽기 메서드: 메서드 레벨 `@Transactional(readOnly = true)` 선언
- UseCase 없이 직접 호출되는 경우(Security Filter 등)도 메서드 레벨로 처리
```

- [ ] **Step 5: DTO 섹션 수정**

`### DTO` 섹션의 마지막 항목을 아래로 교체한다:

기존:
```
- Controller ↔ Service 경계에서만 사용; Service 내부와 Repository 레이어에서는 Entity를 그대로 사용한다
```

변경 후:
```
- Controller ↔ UseCase 경계에서 사용
- UseCase: Request DTO 입력 / Response DTO 반환 / Entity 변환 담당
- Service: Entity · 원시값(UUID, String 등)만 사용 (DTO 금지)
- Repository: Entity만
- Controller: Entity 직접 반환 금지
```

- [ ] **Step 6: 도메인 간 참조 규칙 섹션 신규 추가**

`### Repository` 섹션 바로 아래에 삽입한다:

```markdown
### 도메인 간 참조 규칙

- Service → 타 도메인 Repository 직접 주입 **금지**
- Service → 타 도메인 Service 직접 주입 **금지**
- 교차 도메인 조합이 필요한 경우 UseCase에서만 허용

\`\`\`java
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
\`\`\`
```

- [ ] **Step 7: Claude 행동 지침 항목 추가**

`## Claude 행동 지침 (API)` 섹션에 아래 항목을 추가한다:

```markdown
- 단일 도메인 비즈니스 로직은 `service/`에 작성한다
- 교차 도메인 조합이 필요하면 `application/interfaces/IXxxUseCase` + `application/XxxUseCase`를 생성한다
- Service가 타 도메인 Repository·Service를 직접 주입받는 코드는 작성하지 않는다
- Controller는 `IXxxUseCase` 인터페이스에만 의존한다
```

- [ ] **Step 8: Commit**

```bash
git add services/api/CLAUDE.md
git commit -m "docs: api/CLAUDE.md DDD UseCase 레이어 규칙 추가"
```

---

## Task 3: UserService 리팩토링

**Files:**
- Modify: `services/api/src/main/java/com/terab/api/user/service/UserService.java`
- Delete: `services/api/src/main/java/com/terab/api/user/dto/UserProfile.java`

- [ ] **Step 1: UserService.java 전체 교체**

```java
package com.terab.api.user.service;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;

  @Transactional(readOnly = true)
  public User findByUsername(String username) {
    return userRepository.findByUsername(username)
        .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));
  }

  @Transactional(readOnly = true)
  public User findById(UUID userId) {
    return userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));
  }
}
```

- [ ] **Step 2: UserProfile.java 삭제**

```bash
rm services/api/src/main/java/com/terab/api/user/dto/UserProfile.java
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add services/api/src/main/java/com/terab/api/user/service/UserService.java
git rm services/api/src/main/java/com/terab/api/user/dto/UserProfile.java
git commit -m "refactor: UserService Entity 반환으로 변경, UserProfile DTO 제거"
```

---

## Task 4: AuthService 도메인 로직 재구성

**Files:**
- Modify: `services/api/src/main/java/com/terab/api/auth/service/AuthService.java`

UserRepository 의존 제거, 유즈케이스 흐름(login/refresh/logout/cookie) 제거, 순수 auth 도메인 메서드만 남긴다.

- [ ] **Step 1: AuthService.java 전체 교체**

```java
package com.terab.api.auth.service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.domain.RefreshToken;
import com.terab.api.auth.repository.RefreshTokenRepository;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.rbac.domain.Permission;
import com.terab.api.rbac.domain.Role;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.TokenHasher;
import com.terab.api.user.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@RequiredArgsConstructor
public class AuthService {

  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtProvider jwtProvider;
  private final PasswordEncoder passwordEncoder;
  private final TokenHasher tokenHasher;

  public void validateCredentials(User user, String rawPassword) {
    if (!passwordEncoder.matches(tokenHasher.pepperPassword(rawPassword), user.getPassword())) {
      throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!user.isActive()) {
      throw new ApiException(ErrorCode.ACCOUNT_DISABLED);
    }
  }

  public String generateAccessToken(User user) {
    List<String> permissions = user.getRoles().stream()
        .flatMap(r -> r.getPermissions().stream())
        .map(Permission::toPermissionString)
        .distinct()
        .collect(Collectors.toList());
    List<String> roleNames = user.getRoles().stream()
        .map(Role::getName)
        .collect(Collectors.toList());
    return jwtProvider.generateAccessToken(user.getId(), user.getUsername(), roleNames, permissions);
  }

  @Transactional
  public String issueRefreshToken(User user) {
    String rawToken = jwtProvider.generateRefreshToken(user.getId());
    RefreshToken rt = new RefreshToken();
    rt.setUser(user);
    rt.setTokenHash(tokenHasher.hashRefreshToken(rawToken));
    rt.setExpiresAt(OffsetDateTime.now().plus(Duration.ofMillis(jwtProvider.getRefreshTokenExpMs())));
    refreshTokenRepository.save(rt);
    return rawToken;
  }

  @Transactional
  public User rotateRefreshToken(String rawToken) {
    Claims claims;
    try {
      claims = jwtProvider.validateAndGetClaims(rawToken);
    } catch (JwtException e) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    UUID userId = UUID.fromString(claims.getSubject());
    List<RefreshToken> validTokens = refreshTokenRepository.findValidByUserId(userId);
    RefreshToken stored = validTokens.stream()
        .filter(rt -> tokenHasher.verifyRefreshToken(rawToken, rt.getTokenHash()))
        .findFirst()
        .orElseGet(() -> {
          // JWT 서명은 유효하나 DB에 일치하는 RT 없음 = 이미 rotate된 토큰 재사용 시도
          refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now());
          throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
        });
    // Rotation: 기존 토큰 폐기
    stored.setExpiresAt(OffsetDateTime.now());
    refreshTokenRepository.save(stored);
    return stored.getUser();
  }

  @Transactional
  public void revokeRefreshToken(String rawToken) {
    if (rawToken == null) return;
    try {
      UUID userId = jwtProvider.extractUserId(rawToken);
      refreshTokenRepository.findValidByUserId(userId).stream()
          .filter(rt -> tokenHasher.verifyRefreshToken(rawToken, rt.getTokenHash()))
          .findFirst()
          .ifPresent(rt -> {
            rt.setRevokedAt(OffsetDateTime.now());
            refreshTokenRepository.save(rt);
          });
    } catch (JwtException ignored) {
      // 유효하지 않은 RT도 로그아웃 처리 계속 진행
    }
  }

  public long getRefreshTokenExpMs() {
    return jwtProvider.getRefreshTokenExpMs();
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL` (AuthController이 아직 AuthService에 의존하므로 경고 없어야 함)

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/service/AuthService.java
git commit -m "refactor: AuthService 순수 auth 도메인 로직으로 재구성, UserRepository 의존 제거"
```

---

## Task 5: LoginUseCase (TDD)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/auth/application/interfaces/ILoginUseCase.java`
- Create: `services/api/src/main/java/com/terab/api/auth/application/LoginUseCase.java`
- Create: `services/api/src/test/java/com/terab/api/unit/auth/LoginUseCaseTest.java`

- [ ] **Step 1: ILoginUseCase.java 생성**

```java
package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface ILoginUseCase extends UseCase {
  LoginResponse execute(LoginRequest request, HttpServletResponse response);
}
```

- [ ] **Step 2: LoginUseCaseTest.java 작성 (RED)**

```java
package com.terab.api.unit.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import java.util.HashSet;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.auth.application.LoginUseCase;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;

@ExtendWith(MockitoExtension.class)
class LoginUseCaseTest {

  @Mock UserService userService;
  @Mock AuthService authService;
  @InjectMocks LoginUseCase loginUseCase;

  private User stubUser(UUID id) {
    User user = new User();
    user.setId(id);
    user.setUsername("testuser");
    user.setNickname("테스트");
    user.setRoles(new HashSet<>());
    return user;
  }

  @Nested
  @DisplayName("execute(LoginRequest, HttpServletResponse)")
  class Execute {

    @Test
    @DisplayName("유효한 자격증명이면 LoginResponse를 반환한다")
    void should_return_login_response_when_credentials_valid() {
      UUID userId = UUID.randomUUID();
      User user = stubUser(userId);
      LoginRequest request = new LoginRequest("testuser", "password123");
      HttpServletResponse response = mock(HttpServletResponse.class);

      given(userService.findByUsername("testuser")).willReturn(user);
      given(authService.generateAccessToken(user)).willReturn("access-token");
      given(authService.issueRefreshToken(user)).willReturn("raw-refresh-token");
      given(authService.getRefreshTokenExpMs()).willReturn(604800000L);

      LoginResponse result = loginUseCase.execute(request, response);

      assertThat(result.accessToken()).isEqualTo("access-token");
      assertThat(result.user().username()).isEqualTo("testuser");
      verify(authService).validateCredentials(user, "password123");
    }

    @Test
    @DisplayName("자격증명이 유효하지 않으면 ApiException을 던진다")
    void should_throw_when_credentials_invalid() {
      UUID userId = UUID.randomUUID();
      User user = stubUser(userId);
      LoginRequest request = new LoginRequest("testuser", "wrong");
      HttpServletResponse response = mock(HttpServletResponse.class);

      given(userService.findByUsername("testuser")).willReturn(user);
      willThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS))
          .given(authService).validateCredentials(user, "wrong");

      assertThatThrownBy(() -> loginUseCase.execute(request, response))
          .isInstanceOf(ApiException.class);
    }
  }
}
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.LoginUseCaseTest" -i 2>&1 | tail -10
```

Expected: `LoginUseCase` 클래스 없어서 컴파일 에러

- [ ] **Step 4: LoginUseCase.java 구현**

```java
package com.terab.api.auth.application;

import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LoginUseCase implements ILoginUseCase {

  private final UserService userService;
  private final AuthService authService;

  @Transactional
  @Override
  public LoginResponse execute(LoginRequest request, HttpServletResponse response) {
    User user = userService.findByUsername(request.username());
    authService.validateCredentials(user, request.password());
    String accessToken = authService.generateAccessToken(user);
    String rawRefreshToken = authService.issueRefreshToken(user);
    setRefreshTokenCookie(response, rawRefreshToken);
    return new LoginResponse(accessToken,
        new UserResponse(user.getId(), user.getUsername(), user.getNickname()));
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String rawToken) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", rawToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .maxAge(Duration.ofMillis(authService.getRefreshTokenExpMs()))
        .path("/api/auth")
        .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}
```

- [ ] **Step 5: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.LoginUseCaseTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 2개 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/application/ \
        services/api/src/test/java/com/terab/api/unit/auth/LoginUseCaseTest.java
git commit -m "feat: LoginUseCase 추가 (auth + user 도메인 조합)"
```

---

## Task 6: RefreshTokenUseCase (TDD)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/auth/application/interfaces/IRefreshTokenUseCase.java`
- Create: `services/api/src/main/java/com/terab/api/auth/application/RefreshTokenUseCase.java`
- Create: `services/api/src/test/java/com/terab/api/unit/auth/RefreshTokenUseCaseTest.java`

- [ ] **Step 1: IRefreshTokenUseCase.java 생성**

```java
package com.terab.api.auth.application.interfaces;

import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface IRefreshTokenUseCase extends UseCase {
  LoginResponse execute(String rawRefreshToken, HttpServletResponse response);
}
```

- [ ] **Step 2: RefreshTokenUseCaseTest.java 작성 (RED)**

```java
package com.terab.api.unit.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import java.util.HashSet;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.auth.application.RefreshTokenUseCase;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;

@ExtendWith(MockitoExtension.class)
class RefreshTokenUseCaseTest {

  @Mock AuthService authService;
  @InjectMocks RefreshTokenUseCase refreshTokenUseCase;

  private User stubUser() {
    User user = new User();
    user.setId(UUID.randomUUID());
    user.setUsername("testuser");
    user.setNickname("테스트");
    user.setRoles(new HashSet<>());
    return user;
  }

  @Nested
  @DisplayName("execute(String, HttpServletResponse)")
  class Execute {

    @Test
    @DisplayName("유효한 RT로 갱신 시 새 LoginResponse를 반환한다")
    void should_return_new_login_response_when_valid_rt() {
      User user = stubUser();
      HttpServletResponse response = mock(HttpServletResponse.class);

      given(authService.rotateRefreshToken("valid-rt")).willReturn(user);
      given(authService.generateAccessToken(user)).willReturn("new-access-token");
      given(authService.issueRefreshToken(user)).willReturn("new-refresh-token");
      given(authService.getRefreshTokenExpMs()).willReturn(604800000L);

      LoginResponse result = refreshTokenUseCase.execute("valid-rt", response);

      assertThat(result.accessToken()).isEqualTo("new-access-token");
      verify(authService).rotateRefreshToken("valid-rt");
    }

    @Test
    @DisplayName("유효하지 않은 RT면 ApiException을 던진다")
    void should_throw_when_rt_invalid() {
      HttpServletResponse response = mock(HttpServletResponse.class);
      willThrow(new ApiException(ErrorCode.REFRESH_TOKEN_INVALID))
          .given(authService).rotateRefreshToken("invalid-rt");

      assertThatThrownBy(() -> refreshTokenUseCase.execute("invalid-rt", response))
          .isInstanceOf(ApiException.class);
    }
  }
}
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.RefreshTokenUseCaseTest" -i 2>&1 | tail -10
```

Expected: `RefreshTokenUseCase` 클래스 없어서 컴파일 에러

- [ ] **Step 4: RefreshTokenUseCase.java 구현**

```java
package com.terab.api.auth.application;

import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.user.domain.User;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RefreshTokenUseCase implements IRefreshTokenUseCase {

  private final AuthService authService;

  @Transactional
  @Override
  public LoginResponse execute(String rawRefreshToken, HttpServletResponse response) {
    User user = authService.rotateRefreshToken(rawRefreshToken);
    String accessToken = authService.generateAccessToken(user);
    String newRawRefreshToken = authService.issueRefreshToken(user);
    setRefreshTokenCookie(response, newRawRefreshToken);
    return new LoginResponse(accessToken,
        new UserResponse(user.getId(), user.getUsername(), user.getNickname()));
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String rawToken) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", rawToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .maxAge(Duration.ofMillis(authService.getRefreshTokenExpMs()))
        .path("/api/auth")
        .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}
```

- [ ] **Step 5: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.RefreshTokenUseCaseTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 2개 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/application/interfaces/IRefreshTokenUseCase.java \
        services/api/src/main/java/com/terab/api/auth/application/RefreshTokenUseCase.java \
        services/api/src/test/java/com/terab/api/unit/auth/RefreshTokenUseCaseTest.java
git commit -m "feat: RefreshTokenUseCase 추가"
```

---

## Task 7: LogoutUseCase (TDD)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/auth/application/interfaces/ILogoutUseCase.java`
- Create: `services/api/src/main/java/com/terab/api/auth/application/LogoutUseCase.java`
- Create: `services/api/src/test/java/com/terab/api/unit/auth/LogoutUseCaseTest.java`

- [ ] **Step 1: ILogoutUseCase.java 생성**

```java
package com.terab.api.auth.application.interfaces;

import com.terab.api.common.usecase.UseCase;
import jakarta.servlet.http.HttpServletResponse;

public interface ILogoutUseCase extends UseCase {
  void execute(String rawRefreshToken, HttpServletResponse response);
}
```

- [ ] **Step 2: LogoutUseCaseTest.java 작성 (RED)**

```java
package com.terab.api.unit.auth;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.auth.application.LogoutUseCase;
import com.terab.api.auth.service.AuthService;

@ExtendWith(MockitoExtension.class)
class LogoutUseCaseTest {

  @Mock AuthService authService;
  @InjectMocks LogoutUseCase logoutUseCase;

  @Test
  @DisplayName("로그아웃 시 RT를 폐기하고 쿠키를 초기화한다")
  void should_revoke_rt_and_clear_cookie() {
    HttpServletResponse response = mock(HttpServletResponse.class);

    logoutUseCase.execute("raw-refresh-token", response);

    verify(authService).revokeRefreshToken("raw-refresh-token");
    verify(response).addHeader(org.mockito.ArgumentMatchers.eq("Set-Cookie"),
        org.mockito.ArgumentMatchers.contains("refreshToken="));
  }

  @Test
  @DisplayName("RT가 null이어도 예외 없이 쿠키를 초기화한다")
  void should_clear_cookie_even_if_rt_null() {
    HttpServletResponse response = mock(HttpServletResponse.class);

    logoutUseCase.execute(null, response);

    verify(authService).revokeRefreshToken(null);
  }
}
```

- [ ] **Step 3: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.LogoutUseCaseTest" -i 2>&1 | tail -10
```

Expected: `LogoutUseCase` 클래스 없어서 컴파일 에러

- [ ] **Step 4: LogoutUseCase.java 구현**

```java
package com.terab.api.auth.application;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LogoutUseCase implements ILogoutUseCase {

  private final AuthService authService;

  @Transactional
  @Override
  public void execute(String rawRefreshToken, HttpServletResponse response) {
    authService.revokeRefreshToken(rawRefreshToken);
    clearRefreshTokenCookie(response);
  }

  private void clearRefreshTokenCookie(HttpServletResponse response) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .maxAge(0)
        .path("/api/auth")
        .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}
```

- [ ] **Step 5: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.unit.auth.LogoutUseCaseTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 2개 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/application/interfaces/ILogoutUseCase.java \
        services/api/src/main/java/com/terab/api/auth/application/LogoutUseCase.java \
        services/api/src/test/java/com/terab/api/unit/auth/LogoutUseCaseTest.java
git commit -m "feat: LogoutUseCase 추가"
```

---

## Task 8: GetCurrentUserUseCase

**Files:**
- Create: `services/api/src/main/java/com/terab/api/auth/application/interfaces/IGetCurrentUserUseCase.java`
- Create: `services/api/src/main/java/com/terab/api/auth/application/GetCurrentUserUseCase.java`

- [ ] **Step 1: IGetCurrentUserUseCase.java 생성**

```java
package com.terab.api.auth.application.interfaces;

import java.util.UUID;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.usecase.UseCase;

public interface IGetCurrentUserUseCase extends UseCase {
  UserResponse execute(UUID userId);
}
```

- [ ] **Step 2: GetCurrentUserUseCase.java 구현**

```java
package com.terab.api.auth.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GetCurrentUserUseCase implements IGetCurrentUserUseCase {

  private final UserService userService;

  @Transactional(readOnly = true)
  @Override
  public UserResponse execute(UUID userId) {
    User user = userService.findById(userId);
    return new UserResponse(user.getId(), user.getUsername(), user.getNickname());
  }
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/application/interfaces/IGetCurrentUserUseCase.java \
        services/api/src/main/java/com/terab/api/auth/application/GetCurrentUserUseCase.java
git commit -m "feat: GetCurrentUserUseCase 추가 (/me 엔드포인트용)"
```

---

## Task 9: AuthController 리팩토링 + AuthControllerTest 업데이트

**Files:**
- Modify: `services/api/src/main/java/com/terab/api/auth/controller/AuthController.java`
- Modify: `services/api/src/test/java/com/terab/api/slice/AuthControllerTest.java`

- [ ] **Step 1: AuthControllerTest.java 업데이트 (RED)**

```java
package com.terab.api.slice;

import static com.terab.api.support.SecurityTestSupport.authenticatedUser;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.controller.AuthController;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class AuthControllerTest {

  @Autowired MockMvc mockMvc;

  @MockitoBean ILoginUseCase loginUseCase;
  @MockitoBean IRefreshTokenUseCase refreshTokenUseCase;
  @MockitoBean ILogoutUseCase logoutUseCase;
  @MockitoBean IGetCurrentUserUseCase getCurrentUserUseCase;
  @MockitoBean JwtProvider jwtProvider;

  @Nested
  @DisplayName("POST /api/auth/login")
  class Login {

    @Test
    @DisplayName("유효한 자격증명이면 200과 accessToken을 반환한다")
    void should_return_200_with_valid_credentials() throws Exception {
      UUID userId = UUID.randomUUID();
      given(loginUseCase.execute(any(), any()))
          .willReturn(new LoginResponse("access-token", new UserResponse(userId, "testuser", "테스트 유저")));

      mockMvc.perform(post("/api/auth/login")
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"username":"testuser", "password":"password123"}
                  """))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.accessToken").value("access-token"))
          .andExpect(jsonPath("$.user.username").value("testuser"));
    }

    @Test
    @DisplayName("자격증명이 유효하지 않으면 401을 반환한다")
    void should_return_401_when_credentials_invalid() throws Exception {
      given(loginUseCase.execute(any(), any()))
          .willThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS));

      mockMvc.perform(post("/api/auth/login")
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"username":"wrong", "password":"wrong"}
                  """))
          .andExpect(status().isUnauthorized())
          .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    @DisplayName("요청 바디가 비어있으면 400을 반환한다")
    void should_return_400_when_body_is_empty() throws Exception {
      mockMvc.perform(post("/api/auth/login")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{}"))
          .andExpect(status().isBadRequest());
    }
  }

  @Nested
  @DisplayName("GET /api/auth/me")
  class Me {

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(get("/api/auth/me"))
          .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("인증된 요청이면 200과 사용자 정보를 반환한다")
    void should_return_200_with_valid_auth() throws Exception {
      UUID userId = UUID.randomUUID();
      given(getCurrentUserUseCase.execute(userId))
          .willReturn(new UserResponse(userId, "testuser", "테스트 유저"));

      mockMvc.perform(get("/api/auth/me").with(authenticatedUser(userId)))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.username").value("testuser"));
    }
  }

  @Nested
  @DisplayName("POST /api/auth/logout")
  class Logout {

    @Test
    @DisplayName("인증 없이 요청해도 204를 반환한다")
    void should_return_204_without_auth() throws Exception {
      mockMvc.perform(post("/api/auth/logout"))
          .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("인증된 요청이면 204를 반환한다")
    void should_return_204_with_valid_auth() throws Exception {
      UUID userId = UUID.randomUUID();
      mockMvc.perform(post("/api/auth/logout").with(authenticatedUser(userId)))
          .andExpect(status().isNoContent());
    }
  }
}
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.AuthControllerTest" -i 2>&1 | tail -10
```

Expected: `AuthController`가 아직 `AuthService`를 사용하므로 Bean 주입 실패

- [ ] **Step 3: AuthController.java 전체 교체**

```java
package com.terab.api.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

  private final ILoginUseCase loginUseCase;
  private final IRefreshTokenUseCase refreshTokenUseCase;
  private final ILogoutUseCase logoutUseCase;
  private final IGetCurrentUserUseCase getCurrentUserUseCase;

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(
      @RequestBody @Valid LoginRequest request,
      HttpServletResponse response
  ) {
    return ResponseEntity.ok(loginUseCase.execute(request, response));
  }

  @PostMapping("/refresh")
  public ResponseEntity<LoginResponse> refresh(
      @CookieValue(name = "refreshToken", required = false) String refreshToken,
      HttpServletResponse response
  ) {
    if (refreshToken == null) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    return ResponseEntity.ok(refreshTokenUseCase.execute(refreshToken, response));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = "refreshToken", required = false) String refreshToken,
      HttpServletResponse response
  ) {
    logoutUseCase.execute(refreshToken, response);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  public ResponseEntity<UserResponse> me(
      @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(getCurrentUserUseCase.execute(userDetails.getUserId()));
  }
}
```

- [ ] **Step 4: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.AuthControllerTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 7개 테스트 PASS

- [ ] **Step 5: 전체 테스트 확인**

```bash
cd services/api && ./gradlew test -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: Commit**

```bash
git add services/api/src/main/java/com/terab/api/auth/controller/AuthController.java \
        services/api/src/test/java/com/terab/api/slice/AuthControllerTest.java
git commit -m "refactor: AuthController UseCase 인터페이스 의존으로 변경"
```

---

## Task 10: DeviceService 생성 (순수 device 로직)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/device/service/DeviceService.java`

- [ ] **Step 1: DeviceService.java 생성**

```java
package com.terab.api.device.service;

import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.device.domain.Device;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.repository.DeviceRepository;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DeviceService {

  private final DeviceRepository deviceRepository;

  @Transactional
  public Device saveOrUpdate(User user, PushTokenRequest request) {
    Device device = deviceRepository.findByPushToken(request.pushToken())
        .orElse(new Device());
    device.setUser(user);
    device.setPushToken(request.pushToken());
    device.setPlatform(request.platform());
    device.setLastSeenAt(OffsetDateTime.now());
    if (request.name() != null) {
      device.setName(request.name());
    }
    return deviceRepository.save(device);
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add services/api/src/main/java/com/terab/api/device/service/DeviceService.java
git commit -m "feat: DeviceService 추가 (순수 device 도메인 로직)"
```

---

## Task 11: RegisterPushTokenUseCase (TDD)

**Files:**
- Create: `services/api/src/main/java/com/terab/api/device/application/interfaces/IRegisterPushTokenUseCase.java`
- Create: `services/api/src/main/java/com/terab/api/device/application/RegisterPushTokenUseCase.java`

- [ ] **Step 1: IRegisterPushTokenUseCase.java 생성**

```java
package com.terab.api.device.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;

public interface IRegisterPushTokenUseCase extends UseCase {
  PushTokenResponse execute(UUID userId, PushTokenRequest request);
}
```

- [ ] **Step 2: RegisterPushTokenUseCase.java 구현**

```java
package com.terab.api.device.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.domain.Device;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.device.service.DeviceService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RegisterPushTokenUseCase implements IRegisterPushTokenUseCase {

  private final UserService userService;
  private final DeviceService deviceService;

  @Transactional
  @Override
  public PushTokenResponse execute(UUID userId, PushTokenRequest request) {
    User user = userService.findById(userId);
    Device device = deviceService.saveOrUpdate(user, request);
    return new PushTokenResponse(device.getId());
  }
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api && ./gradlew compileJava -q
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add services/api/src/main/java/com/terab/api/device/application/
git commit -m "feat: RegisterPushTokenUseCase 추가 (user + device 도메인 조합)"
```

---

## Task 12: DeviceController 구현 + DeviceControllerTest 업데이트

**Files:**
- Modify: `services/api/src/main/java/com/terab/api/device/controller/DeviceController.java`
- Modify: `services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java`

- [ ] **Step 1: DeviceControllerTest.java 업데이트 (RED)**

```java
package com.terab.api.slice;

import static com.terab.api.support.SecurityTestSupport.authenticatedUser;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.controller.DeviceController;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(DeviceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class DeviceControllerTest {

  @Autowired MockMvc mockMvc;

  @MockitoBean IRegisterPushTokenUseCase registerPushTokenUseCase;
  @MockitoBean JwtProvider jwtProvider;

  @Nested
  @DisplayName("POST /api/auth/devices/push-token")
  class RegisterPushToken {

    @Test
    @DisplayName("유효한 요청으로 Push Token 등록 시 200과 deviceId를 반환한다")
    void should_return_200_with_deviceId() throws Exception {
      UUID userId = UUID.randomUUID();
      UUID deviceId = UUID.randomUUID();
      given(registerPushTokenUseCase.execute(eq(userId), any()))
          .willReturn(new PushTokenResponse(deviceId));

      mockMvc.perform(post("/api/auth/devices/push-token")
              .with(authenticatedUser(userId))
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"pushToken":"fcm-token-abc123","platform":"android","name":"Galaxy S24"}
                  """))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.deviceId").value(deviceId.toString()));
    }

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(post("/api/auth/devices/push-token")
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"pushToken":"token","platform":"android"}
                  """))
          .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("platform이 유효하지 않으면 400을 반환한다")
    void should_return_400_with_invalid_platform() throws Exception {
      UUID userId = UUID.randomUUID();
      mockMvc.perform(post("/api/auth/devices/push-token")
              .with(authenticatedUser(userId))
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"pushToken":"token","platform":"windows"}
                  """))
          .andExpect(status().isBadRequest());
    }
  }
}
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.DeviceControllerTest" -i 2>&1 | tail -10
```

Expected: `DeviceController`가 비어있으므로 Bean 주입 실패

- [ ] **Step 3: DeviceController.java 구현**

```java
package com.terab.api.device.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth/devices")
@RequiredArgsConstructor
public class DeviceController {

  private final IRegisterPushTokenUseCase registerPushTokenUseCase;

  @PostMapping("/push-token")
  public ResponseEntity<PushTokenResponse> registerPushToken(
      @RequestBody @Valid PushTokenRequest request,
      @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(registerPushTokenUseCase.execute(userDetails.getUserId(), request));
  }
}
```

- [ ] **Step 4: 테스트 재실행 — PASS 확인**

```bash
cd services/api && ./gradlew test --tests "com.terab.api.slice.DeviceControllerTest" -i 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`, 3개 테스트 PASS

- [ ] **Step 5: 전체 테스트 확인**

```bash
cd services/api && ./gradlew test -i 2>&1 | tail -15
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: Commit**

```bash
git add services/api/src/main/java/com/terab/api/device/controller/DeviceController.java \
        services/api/src/test/java/com/terab/api/slice/DeviceControllerTest.java
git commit -m "feat: DeviceController 구현, IRegisterPushTokenUseCase 의존으로 변경"
```

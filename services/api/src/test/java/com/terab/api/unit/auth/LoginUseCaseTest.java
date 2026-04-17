package com.terab.api.unit.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.*;
import java.util.HashSet;
import java.util.UUID;
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
import jakarta.servlet.http.HttpServletResponse;

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

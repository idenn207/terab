package com.terab.api.unit.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.*;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.auth.application.LoginUseCase;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.device.service.DeviceService;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import com.terab.api.twofa.application.interfaces.ICreateChallengeUseCase;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;

@ExtendWith(MockitoExtension.class)
class LoginUseCaseTest {

  @Mock UserService userService;
  @Mock AuthService authService;
  @Mock DeviceService deviceService;
  @Mock TrustedDeviceService trustedDeviceService;
  @Mock ICreateChallengeUseCase createChallengeUseCase;
  @InjectMocks LoginUseCase loginUseCase;

  private User mockUser(UUID id) {
    User user = new User();
    user.setId(id);
    user.setUsername("testuser");
    user.setNickname("테스트");
    user.setRoles(new HashSet<>());
    return user;
  }

  @Nested
  @DisplayName("execute(LoginRequest, String)")
  class Execute {

    @Test
    @DisplayName("Push 기기가 없으면 즉시 토큰을 발급한다")
    void should_issue_tokens_immediately_when_no_push_device() {
      // given
      UUID userId = UUID.randomUUID();
      User user = mockUser(userId);
      LoginRequest request = new LoginRequest("testuser", "password123");

      given(userService.findByUsername("testuser")).willReturn(user);
      given(deviceService.findByUserId(userId)).willReturn(List.of());
      given(authService.generateAccessToken(user)).willReturn("access-token");
      given(authService.issueRefreshToken(user)).willReturn("raw-refresh-token");
      given(authService.getRefreshTokenExpMs()).willReturn(604800000L);

      // when
      AuthResult result = loginUseCase.execute(request, null);

      // then
      assertThat(result.response().accessToken()).isEqualTo("access-token");
      assertThat(result.response().user().username()).isEqualTo("testuser");
      assertThat(result.hasRefreshToken()).isTrue();
      verify(authService).validateCredentials(user, "password123");
    }

    @Test
    @DisplayName("자격증명이 유효하지 않으면 ApiException을 던진다")
    void should_throw_when_credentials_invalid() {
      // given
      UUID userId = UUID.randomUUID();
      User user = mockUser(userId);
      LoginRequest request = new LoginRequest("testuser", "wrong");

      given(userService.findByUsername("testuser")).willReturn(user);
      willThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS))
        .given(authService).validateCredentials(user, "wrong");

      // when / then
      assertThatThrownBy(() -> loginUseCase.execute(request, null))
        .isInstanceOf(ApiException.class);
    }
  }
}

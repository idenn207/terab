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
import com.terab.api.auth.application.RefreshTokenUseCase;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;
import jakarta.servlet.http.HttpServletResponse;

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

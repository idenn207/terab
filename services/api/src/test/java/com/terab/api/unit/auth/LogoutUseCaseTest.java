package com.terab.api.unit.auth;

import static org.mockito.Mockito.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.auth.application.LogoutUseCase;
import com.terab.api.auth.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;

@ExtendWith(MockitoExtension.class)
class LogoutUseCaseTest {
  
  @Mock AuthService authService;
  @InjectMocks LogoutUseCase logoutUseCase;

  
  @Nested
  @DisplayName("execute(String|null, HttpServletResponse)")
  class Execute {

    @Test
    @DisplayName("로그아웃 시 RT를 폐기하고 쿠키를 초기화한다")
    void should_revoke_rt_and_clear_cookie() {
      HttpServletResponse response = mock(HttpServletResponse.class);

      logoutUseCase.execute("raw-refresh-token", response);

      verify(authService).revokeRefreshToken("raw-refresh-token");
      verify(response).addHeader(
        ArgumentMatchers.eq("Set-Cookie"),
        ArgumentMatchers.contains("refreshToken=")
      );
    }

    @Test
    @DisplayName("RT가 null이어도 예외 없이 쿠키를 초기화한다")
    void should_clear_cookie_even_if_rt_null() {
      HttpServletResponse response = mock(HttpServletResponse.class);

      logoutUseCase.execute(null, response);

      verify(authService).revokeRefreshToken(null);
    }
  }
}

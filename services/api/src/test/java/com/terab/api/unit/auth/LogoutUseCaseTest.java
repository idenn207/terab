package com.terab.api.unit.auth;

import static org.mockito.Mockito.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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

  @Nested
  @DisplayName("execute(String)")
  class Execute {

    @Test
    @DisplayName("RT가 있으면 폐기 처리한다")
    void should_revoke_rt_when_present() {
      // when
      logoutUseCase.execute("raw-refresh-token");

      // then
      verify(authService).revokeRefreshToken("raw-refresh-token");
    }

    @Test
    @DisplayName("RT가 null이어도 예외 없이 완료된다")
    void should_complete_without_error_when_rt_null() {
      // when / then — AuthService.revokeRefreshToken은 null을 허용하므로 예외 없음
      logoutUseCase.execute(null);

      verify(authService).revokeRefreshToken(null);
    }
  }
}

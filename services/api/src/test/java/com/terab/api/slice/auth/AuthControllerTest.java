package com.terab.api.slice.auth;

import static com.terab.api.support.SecurityTestSupport.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.AutoConfigureJsonTesters;
import org.springframework.boot.test.json.JacksonTester;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.application.interfaces.ILoginWithBackupCodeUseCase;
import com.terab.api.auth.application.interfaces.ILogoutUseCase;
import com.terab.api.auth.application.interfaces.IRefreshTokenUseCase;
import com.terab.api.auth.controller.AuthController;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.BackupLoginRequest;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtProvider.class})
@AutoConfigureJsonTesters
@ActiveProfiles("test")
class AuthControllerTest {

  @Autowired MockMvc mockMvc;
  @Autowired JacksonTester<LoginRequest> loginJson;
  @Autowired JacksonTester<BackupLoginRequest> backupLoginJson;

  @MockitoBean ILoginUseCase loginUseCase;
  @MockitoBean IRefreshTokenUseCase refreshTokenUseCase;
  @MockitoBean ILoginWithBackupCodeUseCase loginWithBackupCodeUseCase;
  @MockitoBean ILogoutUseCase logoutUseCase;
  @MockitoBean IGetCurrentUserUseCase getCurrentUserUseCase;

  @Nested
  @DisplayName("POST /api/auth/login")
  class DescribeLogin {

    @Test
    @DisplayName("유효한 자격증명이면 200과 accessToken을 반환한다")
    void should_return_200_with_valid_credentials() throws Exception {
      // given
      UUID userId = UUID.randomUUID();
      LoginResponse loginResponse = LoginResponse.authenticated("access-token", new UserResponse(userId, "testuser", "테스트 유저"));
      given(loginUseCase.execute(any(), any()))
        .willReturn(AuthResult.withToken(loginResponse, "raw-refresh-token", 604800000L));

      // when / then
      mockMvc.perform(
        post("/api/auth/login")
          .contentType(MediaType.APPLICATION_JSON)
          .content(loginJson.write(LoginRequest.builder()
            .username("testuser")
            .password("password123")
            .build()).getJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("access-token"))
        .andExpect(jsonPath("$.user.username").value("testuser"));
    }

    @Test
    @DisplayName("자격증명이 유효하지 않으면 401을 반환한다")
    void should_return_401_when_credentials_invalid() throws Exception {
      given(loginUseCase.execute(any(), any()))
        .willThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS));

      mockMvc.perform(
        post("/api/auth/login")
          .contentType(MediaType.APPLICATION_JSON)
          .content(loginJson.write(LoginRequest.builder()
            .username("wrong")
            .password("wrong")
            .build()).getJson()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    @DisplayName("요청 바디가 비어있으면 400을 반환한다")
    void should_return_400_when_body_is_empty() throws Exception {
      mockMvc.perform(
        post("/api/auth/login")
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}"))
        .andExpect(status().isBadRequest());
    }
  }

  @Nested
  @DisplayName("POST /api/auth/login/backup")
  class DescribeBackupLogin {

    @Test
    @DisplayName("유효한 BackupCode면 200과 accessToken을 반환한다")
    void should_return_200_with_valid_backup_code() throws Exception {
      UUID userId = UUID.randomUUID();
      LoginResponse loginResponse = LoginResponse.authenticated("access-token", new UserResponse(userId, "testuser", "테스트 유저"));
      given(loginWithBackupCodeUseCase.execute(any()))
        .willReturn(AuthResult.withToken(loginResponse, "raw-refresh-token", 604800000L));
      

      mockMvc.perform(
        post("/api/auth/login/backup")
          .contentType(MediaType.APPLICATION_JSON)
          .content(backupLoginJson.write(BackupLoginRequest.builder()
            .username("testuser")
            .password("password123")
            .backupCode("A3K9-MZ7P")
            .build()).getJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("access-token"));
    }

    @Test
    @DisplayName("BackupCode가 유효하지 않으면 400을 반환한다")
    void should_return_401_when_credentials_invalid() throws Exception {
      mockMvc.perform(
        post("/api/auth/login/backup")
          .contentType(MediaType.APPLICATION_JSON)
          .content(backupLoginJson.write(BackupLoginRequest.builder()
            .username("testuser")
            .password("password123")
            .backupCode("WRONG-CODE")
            .build()).getJson()))
        .andExpect(status().isBadRequest());
    }
  }

  @Nested
  @DisplayName("GET /api/auth/me")
  class DescribeMe {

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
  class DescribeLogout {

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

      mockMvc.perform(post("/api/auth/logout")
          .with(authenticatedUser(userId)))
        .andExpect(status().isNoContent());
    }
  }
}

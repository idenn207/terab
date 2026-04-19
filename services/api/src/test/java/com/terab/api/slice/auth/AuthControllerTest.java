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
        .willReturn(
          new LoginResponse("access-token",
          new UserResponse(userId, "testuser", "테스트 유저"))
        );

      mockMvc.perform(
        post("/api/auth/login")
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

      mockMvc.perform(
        post("/api/auth/login")
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
      mockMvc.perform(
        post("/api/auth/login")
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

      mockMvc.perform(post("/api/auth/logout")
          .with(authenticatedUser(userId)))
        .andExpect(status().isNoContent());
    }
  }
}

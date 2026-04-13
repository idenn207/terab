package com.terab.api.slice;

import static com.terab.api.support.SecurityTestSupport.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.auth.controller.AuthController;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;
import com.terab.api.user.repository.UserRepository;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class AuthControllerTest {

  @Autowired
  MockMvc mockMvc;

  @MockitoBean
  AuthService authService;

  @MockitoBean
  UserRepository userRepository;

  @MockitoBean
  JwtProvider jwtProvider;
  
  @Nested
  @DisplayName("POST /api/auth/login")
  class Login {

    @Test
    void should_return_200_with_valid_credentials() throws Exception {
      UUID userId = UUID.randomUUID();
      given(authService.login(any(), any())).willReturn(
        new LoginResponse("access-token", new UserResponse(userId, "testuser", "테스트 유저"))
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
    void should_return_401_when_credentials_invalid() throws Exception {
      given(authService.login(any(), any())).willThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS));

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
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(get("/api/auth/me"))
        .andExpect(status().isUnauthorized());
    }

    @Test
    void should_return_200_with_valid_auth() throws Exception {
      UUID userId = UUID.randomUUID();
      var mockUser = new com.terab.api.user.domain.User();
      mockUser.setUsername("testuser");
      mockUser.setNickname("테스트 유저");

      given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));

      mockMvc.perform(get("/api/auth/me")
          .with(authenticatedUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("testuser"));
    }
  }

  @Nested
  @DisplayName("POST /api/auth/logout")
  class Logout {

    @Test
    void should_return_204_without_auth() throws Exception {
      mockMvc.perform(post("/api/auth/logout"))
        .andExpect(status().isNoContent());
    }

    @Test
    void should_return_204_with_valid_auth() throws Exception {
      UUID userId = UUID.randomUUID();

      mockMvc.perform(post("/api/auth/logout")
          .with(authenticatedUser(userId)))
        .andExpect(status().isNoContent());
    }
  }
}

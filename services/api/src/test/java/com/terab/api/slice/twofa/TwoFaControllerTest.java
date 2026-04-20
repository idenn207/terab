package com.terab.api.slice.twofa;

import static com.terab.api.support.SecurityTestSupport.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.List;
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
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;
import com.terab.api.twofa.application.interfaces.IGetChallengeStatusUseCase;
import com.terab.api.twofa.application.interfaces.IResendChallengeUseCase;
import com.terab.api.twofa.application.interfaces.IRespondToChallengeUseCase;
import com.terab.api.twofa.controller.TwoFaController;
import com.terab.api.twofa.dto.ChallengeStatusResponse;

@WebMvcTest(TwoFaController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtProvider.class})
@ActiveProfiles("test")
class TwoFaControllerTest {
  
  @Autowired MockMvc mockMvc;
  @MockitoBean IGetChallengeStatusUseCase getChallengeStatusUseCase;
  @MockitoBean IRespondToChallengeUseCase respondToChallengeUseCase;
  @MockitoBean IResendChallengeUseCase resendChallengeUseCase;

  @Nested
  @DisplayName("GET /api/auth/2fa/challenge/{id}/status")
  class DescribeGetStatus {

    @Test
    @DisplayName("인증 없이 요청해도 200과 challenge 상태를 반환한다")
    void should_return_200_without_auth() throws Exception {
      given(getChallengeStatusUseCase.execute(any()))
        .willReturn(ChallengeStatusResponse.pending(List.of("47", "82", "13"), 55));

      mockMvc.perform(get("/api/auth/2fa/challenge/{id}/status", UUID.randomUUID()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDING"))
        .andExpect(jsonPath("$.options").isArray());
    }
  }

  @Nested
  @DisplayName("POST /api/auth/2fa/challenge/{id}/respond")
  class DescribeRespond {

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(
        post("/api/auth/2fa/challenge/{id}/respond", UUID.randomUUID())
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
            {"selectedNumber":"47"}
          """))
        .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("인증된 요청이면 204를 반환한다")
    void should_return_204_with_valid_auth() throws Exception {
      willDoNothing().given(respondToChallengeUseCase).execute(any(), any(), any());

      mockMvc.perform(
        post("/api/auth/2fa/challenge/{id}/respond", UUID.randomUUID())
          .with(authenticatedUser(UUID.randomUUID()))
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
            {"selectedNumber":"47"}
          """))
        .andExpect(status().isNoContent());
    }
  }
}

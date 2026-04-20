package com.terab.api.slice.backupcode;

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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.terab.api.backupcode.application.interfaces.IGetBackupCodeCountUseCase;
import com.terab.api.backupcode.application.interfaces.IRegenerateBackupCodesUseCase;
import com.terab.api.backupcode.controller.BackupCodeController;
import com.terab.api.backupcode.dto.BackupCodeCountResponse;
import com.terab.api.backupcode.dto.BackupCodesResponse;
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(BackupCodeController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtProvider.class})
@ActiveProfiles("test")
class BackupCodeControllerTest {
  
  @Autowired MockMvc mockMvc;
  @MockitoBean IRegenerateBackupCodesUseCase regenerateUseCase;
  @MockitoBean IGetBackupCodeCountUseCase countUseCase;

  @Nested
  @DisplayName("POST /api/auth/backup-codes/regenerate")
  class DescribeRegenerate {

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(post("/api/auth/backup-codes/regenerate"))
        .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("인증된 요청이면 백업 코드 목록을 반환한다")
    void should_return_codes_with_valid_auth() throws Exception {
      UUID userId = UUID.randomUUID();
      given(regenerateUseCase.execute(any()))
        .willReturn(new BackupCodesResponse(List.of("A3K9-MZ7P", "B2X4-NK1Q")));

      mockMvc.perform(post("/api/auth/backup-codes/regenerate").with(authenticatedUser(userId)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.codes").isArray());
    }
  }

  @Nested
  @DisplayName("GET /api/auth/backup-codes/count")
  class DescribeCount {

    @Test
    @DisplayName("인증된 요청이면 남은 코드 수를 반환한다")
    void should_return_count_with_auth() throws Exception {
      UUID userId = UUID.randomUUID();
      given(countUseCase.execute(any())).willReturn(new BackupCodeCountResponse(6));

      mockMvc.perform(get("/api/auth/backup-codes/count").with(authenticatedUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.count").value(6));
    }
  }
}

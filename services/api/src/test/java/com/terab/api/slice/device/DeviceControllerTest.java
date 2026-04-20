package com.terab.api.slice.device;

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
import com.terab.api.common.exception.GlobalExceptionHandler;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.controller.DeviceController;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.SecurityConfig;

@WebMvcTest(DeviceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtProvider.class})
@AutoConfigureJsonTesters
@ActiveProfiles("test")
class DeviceControllerTest {
  
  @Autowired MockMvc mockMvc;
  @Autowired JacksonTester<PushTokenRequest> pushTokenJson;

  @MockitoBean IRegisterPushTokenUseCase registerPushTokenUseCase;
  @MockitoBean JwtProvider jwtProvider;

  @Nested
  @DisplayName("POST /api/auth/devices/push-token")
  class RegisterPushToken {

    @Test
    @DisplayName("유효한 요청으로 Push Token 등록 시 200과 deviceId를 반환한다")
    void should_return_200_with_deviceId() throws Exception {
      UUID userId = UUID.randomUUID();
      UUID deviceId = UUID.randomUUID();
      given(registerPushTokenUseCase.execute(eq(userId), any()))
        .willReturn(new PushTokenResponse(deviceId));
        
      mockMvc.perform(
        post("/api/auth/devices/push-token")
          .with(authenticatedUser(userId))
          .contentType(MediaType.APPLICATION_JSON)
          .content(pushTokenJson.write(PushTokenRequest.builder()
            .pushToken("fcm-token-abc123")
            .platform("android")
            .name("Galaxy S24")
            .build()).getJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deviceId").value(deviceId.toString()));
    }

    @Test
    @DisplayName("인증 없이 요청하면 401을 반환한다")
    void should_return_401_without_auth() throws Exception {
      mockMvc.perform(
        post("/api/auth/devices/push-token")
          .contentType(MediaType.APPLICATION_JSON)
          .content(pushTokenJson.write(PushTokenRequest.builder()
            .pushToken("token")
            .platform("android")
            .build()).getJson()))
        .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("platform이 유효하지 않으면 400을 반환한다")
    void should_return_400_with_invalid_platform() throws Exception {
      UUID userId = UUID.randomUUID();
      mockMvc.perform(
        post("/api/auth/devices/push-token")
          .with(authenticatedUser(userId))
          .contentType(MediaType.APPLICATION_JSON)
          .content(pushTokenJson.write(PushTokenRequest.builder()
            .pushToken("token")
            .platform("windows")
            .build()).getJson()))
        .andExpect(status().isBadRequest());
    }
  }

}

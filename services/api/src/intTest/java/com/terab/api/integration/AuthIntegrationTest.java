package com.terab.api.integration;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.terab.api.device.domain.Device;
import com.terab.api.device.repository.DeviceRepository;
import com.terab.api.security.TokenHasher;
import com.terab.api.support.IntegrationTestBase;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;

class AuthIntegrationTest extends IntegrationTestBase {

  @Autowired TestRestTemplate restTemplate;
  @Autowired UserRepository userRepository;
  @Autowired DeviceRepository deviceRepository;
  @Autowired PasswordEncoder passwordEncoder;
  @Autowired TokenHasher tokenHasher;

  @SuppressWarnings("unchecked")
  @Test
  @DisplayName("OWNER 계정으로 로그인하면 accessToken을 반환한다")
  void login_withOwnerCredentials_returnsAccessToken() {
    // application-integration.yml:app.owner.username=owner,password=owner-test-password-123
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<Map<String, String>> request = new HttpEntity<>(
      Map.of("username", "owner", "password","owner-test-password-123"),
      headers
    );

    @SuppressWarnings("rawtypes")
    ResponseEntity<Map> response = restTemplate.postForEntity("/api/auth/login", request, Map.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).containsEntry("status", "AUTHENTICATED");
    assertThat(response.getBody()).containsKey("accessToken");
    assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE))
      .anyMatch(cookie -> cookie.startsWith("refreshToken="));
  }

  @Test
  @DisplayName("잘못된 비밀번호로 로그인하면 401을 반환한다")
  void login_withWrongPassword_returns401() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<Map<String, String>> request = new HttpEntity<>(
      Map.of("username", "owner", "password", "wrong-password"),
      headers
    );

    ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
      "/api/auth/login",
      HttpMethod.POST,
      request,
      new ParameterizedTypeReference<Map<String, Object>>() {}
    );

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody()).containsEntry("code", "INVALID_CREDENTIALS");
  }

  @Test
  @DisplayName("인증 없이 /api/auth/me 요청 시 401을 반환한다")
  void me_withoutAuth_returns401() {
      @SuppressWarnings("rawtypes")
      ResponseEntity<Map> response = restTemplate.getForEntity("/api/auth/me", Map.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Nested
  @DisplayName("Push 기기가 등록된 사용자 로그인 — 2FA 경로")
  class TwoFactorLogin {

    private static final String TWOFA_USERNAME = "twofa-inttest-user";
    private static final String TWOFA_PASSWORD = "twofa-test-password-123";

    @BeforeEach
    void setUp() {
      User user = new User();
      user.setUsername(TWOFA_USERNAME);
      user.setNickname("2FA테스트");
      user.setPassword(passwordEncoder.encode(tokenHasher.pepperPassword(TWOFA_PASSWORD)));
      user.setActive(true);
      user = userRepository.save(user);

      Device device = new Device();
      device.setUser(user);
      device.setName("Integration Test Device");
      device.setPushToken("fcm-inttest-push-token");
      device.setPlatform("android");
      deviceRepository.save(device);
    }

    @AfterEach
    void tearDown() {
      // users 삭제 시 devices, two_fa_challenges ON DELETE CASCADE 처리
      userRepository.findByUsername(TWOFA_USERNAME).ifPresent(userRepository::delete);
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("Push 기기가 등록된 사용자로 로그인하면 2FA_REQUIRED와 challengeId를 반환한다")
    void login_withPushDevice_returns2faRequired() {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      HttpEntity<Map<String, String>> request = new HttpEntity<>(
        Map.of("username", TWOFA_USERNAME, "password", TWOFA_PASSWORD),
        headers
      );

      @SuppressWarnings("rawtypes")
      ResponseEntity<Map> response = restTemplate.postForEntity("/api/auth/login", request, Map.class);

      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getBody()).containsEntry("status", "2FA_REQUIRED");
      assertThat(response.getBody()).containsKey("challengeId");
      assertThat(response.getBody()).doesNotContainKey("accessToken");
      List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
      assertThat(cookies == null || cookies.stream().noneMatch(c -> c.startsWith("refreshToken=")))
        .as("2FA 응답에는 refreshToken 쿠키가 없어야 한다")
        .isTrue();
    }
  }
}

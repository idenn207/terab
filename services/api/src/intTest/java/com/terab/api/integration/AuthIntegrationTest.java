package com.terab.api.integration;

import static org.assertj.core.api.Assertions.*;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
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
import com.terab.api.support.IntegrationTestBase;

class AuthIntegrationTest extends IntegrationTestBase {
  
  @Autowired
  TestRestTemplate restTemplate;

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
}

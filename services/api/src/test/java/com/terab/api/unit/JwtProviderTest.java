package com.terab.api.unit;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import com.terab.api.security.JwtProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

class JwtProviderTest {
  private static final String SECRET = "test-secret-key-that-is-at-least-256-bits-long-for-hs256-algorithm";

  private JwtProvider jwtProvider;

  @BeforeEach
  void setUp() {
    jwtProvider = new JwtProvider(SECRET, 900_000L, 604_800_000L);
  }

  @Nested
  @DisplayName("generateAccessToken")
  class GenerateAccessToken {

    @Test
    void should_contain_userId_as_subject() {
      UUID userId = UUID.randomUUID();
      String token = jwtProvider.generateAccessToken(userId, "testuser", List.of("USER"), List.of("file:read"));
      Claims claims = jwtProvider.validateAndGetClaims(token);
      assertThat(claims.getSubject()).isEqualTo(userId.toString());
    }

    @Test
    void should_contain_username_and_permissions_claims() {
      UUID userId = UUID.randomUUID();
      String token = jwtProvider.generateAccessToken(userId, "testuser", List.of("USER"), List.of("file:read", "file:write"));
      Claims claims = jwtProvider.validateAndGetClaims(token);
      assertThat(claims.get("username", String.class)).isEqualTo("testuser");
      assertThat(claims.get("permissions", List.class)).contains("file:read", "file:write");
    }
  }

  @Nested
  @DisplayName("validateAndGetClaims")
  class Validate {

    @Test
    void should_throw_on_expired_token() {
      JwtProvider shortLived = new JwtProvider(SECRET, -1000L, 604_800_000L);
      String token = shortLived.generateAccessToken(UUID.randomUUID(), "user", List.of(), List.of());
      assertThatThrownBy(() -> jwtProvider.validateAndGetClaims(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void should_throw_on_tampered_token() {
      String token = jwtProvider.generateAccessToken(UUID.randomUUID(), "user", List.of(), List.of());
      String tampered = token.substring(0, token.length() - 5) + "XXXXX";
      assertThatThrownBy(() -> jwtProvider.validateAndGetClaims(tampered)).isInstanceOf(JwtException.class);
    }
  }
}

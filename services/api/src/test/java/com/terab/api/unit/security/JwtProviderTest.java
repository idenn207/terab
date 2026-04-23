package com.terab.api.unit.security;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import com.terab.api.security.ClaimsUtil;
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
    @DisplayName("생성된 토큰의 subject에 userId가 포함된다")
    void should_contain_userId_as_subject() {
      UUID userId = UUID.randomUUID();
      String token = jwtProvider.generateAccessToken(userId, "testuser", List.of("USER"), List.of("file:read"));
      Claims claims = jwtProvider.validateAndGetClaims(token);
      assertThat(claims.getSubject()).isEqualTo(userId.toString());
    }

    @Test
    @DisplayName("생성된 토큰에 username과 permissions 클레임이 포함된다")
    void should_contain_username_and_permissions_claims() {
      UUID userId = UUID.randomUUID();
      String token = jwtProvider.generateAccessToken(userId, "testuser", List.of("USER"), List.of("file:read", "file:write"));
      Claims claims = jwtProvider.validateAndGetClaims(token);

      assertThat(ClaimsUtil.getString(claims, "username")).isEqualTo("testuser");
      assertThat(ClaimsUtil.getStringList(claims, "permissions")).contains("file:read", "file:write");
    }
  }

  @Nested
  @DisplayName("validateAndGetClaims")
  class Validate {

    @Test
    @DisplayName("만료된 토큰 검증 시 JwtException을 던진다")
    void should_throw_on_expired_token() {
      JwtProvider shortLived = new JwtProvider(SECRET, -1000L, 604_800_000L);
      String token = shortLived.generateAccessToken(UUID.randomUUID(), "user", List.of(), List.of());
      assertThatThrownBy(() -> jwtProvider.validateAndGetClaims(token)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("변조된 토큰 검증 시 JwtException을 던진다")
    void should_throw_on_tampered_token() {
      String token = jwtProvider.generateAccessToken(UUID.randomUUID(), "user", List.of(), List.of());
      String tampered = token.substring(0, token.length() - 5) + "XXXXX";
      assertThatThrownBy(() -> jwtProvider.validateAndGetClaims(tampered)).isInstanceOf(JwtException.class);
    }
  }

  @Nested
  @DisplayName("generateRefreshToken")
  class GenerateRefreshToken {

    @Test
    @DisplayName("생성된 RT의 subject에 userId가 포함된다")
    void should_contain_userId_as_subject() {
      UUID userId = UUID.randomUUID();
      String token = jwtProvider.generateRefreshToken(userId);
      Claims claims = jwtProvider.validateAndGetClaims(token);
      assertThat(claims.getSubject()).isEqualTo(userId.toString());
    }
  }
}

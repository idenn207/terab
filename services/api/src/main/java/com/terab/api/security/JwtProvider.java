package com.terab.api.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtProvider {
  private final SecretKey key;
  private final long accessTokenExpMs;
  private final long refreshTokenExpMs;

  public JwtProvider(
    @Value("${jwt.secret}") String secret,
    @Value("${jwt.access-token-expiration-ms}") long accessTokenExpMs,
    @Value("${jwt.refresh-token-expiration-ms}") long refreshTokenExpMs
  ) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.accessTokenExpMs = accessTokenExpMs;
    this.refreshTokenExpMs = refreshTokenExpMs;
  }

  public String generateAccessToken(UUID userId, String username, List<String> roles, List<String> permissions){
    Date now = new Date();
    return Jwts.builder()
      .subject(userId.toString())
      .claim("username", username)
      .claim("roles", roles)
      .claim("permissions", permissions)
      .issuedAt(now)
      .expiration(new Date(now.getTime() + accessTokenExpMs))
      .signWith(key, Jwts.SIG.HS256)
      .compact();
  }

  public String generateRefreshToken(UUID userId) {
    Date now = new Date();
    return Jwts.builder()
      .subject(userId.toString())
      .claim("type", "refresh")
      .issuedAt(now)
      .expiration(new Date(now.getTime() + refreshTokenExpMs))
      .signWith(key, Jwts.SIG.HS256)
      .compact();
  }

  public Claims validateAndGetClaims(String token) {
    return Jwts.parser()
      .verifyWith(key)
      .build()
      .parseSignedClaims(token)
      .getPayload();
  }

  public UUID extractUserId(String token) {
    return UUID.fromString(validateAndGetClaims(token).getSubject());
  }

  public long getRefreshTokenExpMs() {
    return refreshTokenExpMs;
  }
}

package com.terab.api.auth.service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.domain.RefreshToken;
import com.terab.api.auth.repository.RefreshTokenRepository;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.rbac.domain.Permission;
import com.terab.api.rbac.domain.Role;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.TokenHasher;
import com.terab.api.user.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {
  
  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtProvider jwtProvider;
  private final PasswordEncoder passwordEncoder;
  private final TokenHasher tokenHasher;

  public void validateCredentials(User user, String rawPassword) {
    if (!passwordEncoder.matches(tokenHasher.pepperPassword(rawPassword), user.getPassword())) {
      throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.isActive()) {
      throw new ApiException(ErrorCode.ACCOUNT_DISABLED);
    }
  }

  public String generateAccessToken(User user) {
    List<String> permissions = user.getRoles().stream()
      .flatMap(r -> r.getPermissions().stream())
      .map(Permission::toPermissionString)
      .distinct()
      .collect(Collectors.toList());

    List<String> roleNames = user.getRoles().stream()
      .map(Role::getName)
      .collect(Collectors.toList());

    return jwtProvider.generateAccessToken(user.getId(), user.getUsername(), roleNames, permissions);
  }

  @Transactional
  public String issueRefreshToken(User user) {
    String rawToken = jwtProvider.generateRefreshToken(user.getId());
    RefreshToken rt = new RefreshToken();
    rt.setUser(user);
    rt.setTokenHash(tokenHasher.hashRefreshToken(rawToken));
    rt.setExpiresAt(OffsetDateTime.now().plus(Duration.ofMillis(jwtProvider.getRefreshTokenExpMs())));
    refreshTokenRepository.save(rt);

    return rawToken;
  }

  @Transactional
  public User rotateRefreshToken(String rawRefreshToken) {
    Claims claims;
    try {
      claims = jwtProvider.validateAndGetClaims(rawRefreshToken);
    } catch (JwtException e) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    UUID userId = UUID.fromString(claims.getSubject());

    List<RefreshToken> validTokens = refreshTokenRepository.findValidByUserId(userId);
    RefreshToken stored = validTokens.stream()
      .filter(rt -> tokenHasher.verifyRefreshToken(rawRefreshToken, rt.getTokenHash()))
      .findFirst()
      .orElseGet(() -> {
        // JWT 서명은 유효하나 DB에 일치하는 RT 없음 = 이미 rotate된 토큰 재사용 시도
        // 해당 userId의 모든 활성 RT를 즉시 무효화 (family invalidation)
        refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now());
        throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
      });

    // Rotation: 기존 토큰 폐기
    stored.setExpiresAt(OffsetDateTime.now());
    refreshTokenRepository.save(stored);

    return stored.getUser();
  }

  @Transactional
  public void revokeRefreshToken(String rawRefreshToken) {
    if (rawRefreshToken == null) return;
    
    try {
      UUID userId = jwtProvider.extractUserId(rawRefreshToken);
      refreshTokenRepository.findValidByUserId(userId).stream()
        .filter(rt -> tokenHasher.verifyRefreshToken(rawRefreshToken, rt.getTokenHash()))
        .findFirst()
        .ifPresent(rt -> {
          rt.setRevokedAt(OffsetDateTime.now());
          refreshTokenRepository.save(rt);
        });
    } catch (JwtException ignored) {
      // 유효하지 않은 RT도 로그아웃 처리 계속 진행
    }
  }

  public long getRefreshTokenExpMs() {
    return jwtProvider.getRefreshTokenExpMs();
  }
}

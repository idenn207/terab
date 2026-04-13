package com.terab.api.auth.service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.domain.RefreshToken;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.repository.RefreshTokenRepository;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.rbac.domain.Permission;
import com.terab.api.rbac.domain.Role;
import com.terab.api.security.JwtProvider;
import com.terab.api.security.TokenHasher;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {
  
  private final UserRepository userRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtProvider jwtProvider;
  private final PasswordEncoder passwordEncoder;
  private final TokenHasher tokenHasher;

  public LoginResponse login(LoginRequest request, HttpServletResponse response) {
    User user = userRepository.findByUsername(request.username())
      .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));

    if (!passwordEncoder.matches(tokenHasher.pepperPassword(request.password()), user.getPassword())) {
      throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.isActive()) {
      throw new ApiException(ErrorCode.ACCOUNT_DISABLED);
    }

    return issueTokens(user, response);
  }

  public LoginResponse refresh(String rawRefreshToken, HttpServletResponse response) {
    Claims claims;
    try {
      claims = jwtProvider.validateAndGetClaims(rawRefreshToken);
    } catch (JwtException e) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    UUID userId = UUID.fromString(claims.getSubject());

    RefreshToken stored = refreshTokenRepository.findValidByUserId(userId)
      .stream()
      .filter(rt -> tokenHasher.verifyRefreshToken(rawRefreshToken, rt.getTokenHash()))
      .findFirst()
      .orElseThrow(() -> new ApiException(ErrorCode.REFRESH_TOKEN_INVALID));

    // Rotation: 기존 토큰 폐기
    stored.setExpiresAt(OffsetDateTime.now());
    refreshTokenRepository.save(stored);

    return issueTokens(stored.getUser(), response);
  }

  public void logout(UUID userId, String rawRefreshToken, HttpServletResponse response) {
    if (rawRefreshToken != null) {
      refreshTokenRepository.findValidByUserId(userId)
        .stream()
        .filter(rt -> tokenHasher.verifyRefreshToken(rawRefreshToken, rt.getTokenHash()))
        .findFirst()
        .ifPresent(rt -> {
          rt.setRevokedAt(OffsetDateTime.now());
          refreshTokenRepository.save(rt);
        });
    }
    addClearRefreshTokenCookie(response);
  }

  private LoginResponse issueTokens(User user, HttpServletResponse response) {
    List<String> permissions = user.getRoles().stream()
      .flatMap(r -> r.getPermissions().stream())
      .map(Permission::toPermissionString)
      .distinct()
      .collect(Collectors.toList());

    List<String> roleNames = user.getRoles().stream()
      .map(Role::getName)
      .collect(Collectors.toList());

    String accessToken = jwtProvider.generateAccessToken(
      user.getId(), user.getUsername(), roleNames, permissions
    );
    String rawRefreshToken = jwtProvider.generateRefreshToken(user.getId());

    RefreshToken rt = new RefreshToken();
    rt.setUser(user);
    rt.setTokenHash(tokenHasher.hashRefreshToken(rawRefreshToken));
    rt.setExpiresAt(OffsetDateTime.now().plus(
      Duration.ofMillis(jwtProvider.getRefreshTokenExpMs())
    ));
    refreshTokenRepository.save(rt);

    addRefreshTokenCookie(response, rawRefreshToken);

    return new LoginResponse(
      accessToken,
      new UserResponse(user.getId(), user.getUsername(), user.getNickname())
    );
  }

  private void addRefreshTokenCookie(HttpServletResponse response, String token) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", token)
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(Duration.ofMillis((jwtProvider.getRefreshTokenExpMs())))
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  private void addClearRefreshTokenCookie(HttpServletResponse response) {
    ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
      .httpOnly(true)
      .secure(true)
      .sameSite("Strict")
      .maxAge(0)
      .path("/api/auth")
      .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}

package com.terab.api.trusteddevice.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.trusteddevice.domain.TrustedDevice;
import com.terab.api.trusteddevice.repository.TrustedDeviceRepository;
import com.terab.api.user.domain.User;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TrustedDeviceService {
  
  private static final int TRUST_DURATION_DAYS = 30;
  private final TrustedDeviceRepository repository;

  @Transactional
  public TrustedDevice register(User user, String rawToken, String userAgent) {
    TrustedDevice device = new TrustedDevice();
    device.setUser(user);
    device.setTokenHash(hashToken(rawToken));
    device.setUserAgent(userAgent);
    device.setExpiresAt(OffsetDateTime.now().plusDays(TRUST_DURATION_DAYS));
    return repository.save(device);
  }

  @Transactional(readOnly = true)
  public boolean verify(String rawToken, User user) {
    return repository.findByTokenHash(hashToken(rawToken))
      .filter(d -> d.getUser().getId().equals(user.getId()))
      .filter(TrustedDevice::isValid)
      .isPresent();
  }

  @Transactional(readOnly = true)
  public List<TrustedDevice> findByUser(User user) {
    return repository.findByUser(user);
  }

  @Transactional
  public void revoke(UUID deviceId, UUID userId) {
    TrustedDevice device = repository.findById(deviceId)
      .orElseThrow(() -> new ApiException(ErrorCode.TRUSTED_DEVICE_NOT_FOUND));
    if(!device.getUser().getId().equals(userId)) {
      throw new ApiException(ErrorCode.FORBIDDEN);
    }
    repository.delete(device);
  }

  public void setTrustCookie(HttpServletResponse response, String rawToken) {
    ResponseCookie cookie = ResponseCookie.from("trustToken", rawToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("Strict")
        .maxAge(Duration.ofDays(TRUST_DURATION_DAYS))
        .path("/api/auth")
        .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  private String hashToken(String rawToken) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new RuntimeException("SHA-256 not available", e);
    }
  }
}
